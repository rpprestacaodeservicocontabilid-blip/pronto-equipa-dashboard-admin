import { Component, DestroyRef, Input, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, forkJoin, of, switchMap } from 'rxjs';
import { apiErrorMessage } from '../../../../core/api/api-error';
import { AuthService } from '../../../../core/auth/auth.service';
import { ComponentCardComponent } from '../../../../shared/components/common/component-card/component-card.component';
import {
  CONTRACT_ACTIONS, CONTRACT_STATUSES, CompanyContext, ContractAction, ContractRecord, ContractStatus,
  ContractTerms, ContractType, EmployeeSummary, EmploymentContract,
} from '../../domain/contracts.models';
import { ContractsApi } from '../../infrastructure/contracts-api.service';
import { contractAmount, employeeName, formatContractDate } from '../format-contract';
import { ContractActionComponent } from './contract-action.component';
import { ContractDocumentsComponent } from '../documents/contract-documents.component';
import { ContractSalaryComponent } from './contract-salary.component';

const DETAIL_TABS = {
  overview: 'Overview', employee: 'Employee', conditions: 'Conditions', renewals: 'Renewals',
  amendments: 'Amendments', suspensions: 'Suspensions', terminations: 'Terminations',
  documents: 'Documents', history: 'History',
} as const;
type DetailTab = keyof typeof DETAIL_TABS;

const RECORD_TYPES: Partial<Record<DetailTab, readonly string[]>> = {
  renewals: ['RENEWAL'], amendments: ['AMENDMENT'], suspensions: ['SUSPENSION', 'RESUMPTION'],
  terminations: ['TERMINATION'],
};

const TERM_LABELS = {
  hiringRegime: 'Hiring arrangement', probationDays: 'Probation days', payFrequency: 'Pay frequency',
  allowances: 'Allowances', paymentTerms: 'Payment terms', workingHours: 'Working hours', schedule: 'Schedule',
  workplace: 'Workplace', department: 'Department', jobTitle: 'Job title', notes: 'Notes',
};

const LIFECYCLE: readonly ContractStatus[] = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE'];

@Component({
  selector: 'app-contract-detail',
  standalone: true,
  imports: [RouterLink, ComponentCardComponent, ContractActionComponent, ContractDocumentsComponent, ContractSalaryComponent],
  templateUrl: './contract-detail.component.html',
})
export class ContractDetailComponent implements OnInit {
  @Input({ required: true }) context!: CompanyContext;
  @Input({ required: true }) id!: string;

  private readonly api = inject(ContractsApi);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly query = toSignal(inject(ActivatedRoute).queryParamMap, { requireSync: true });
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly activityError = signal('');
  protected readonly employeeError = signal('');
  protected readonly notice = signal('');
  protected readonly contract = signal<EmploymentContract | null>(null);
  protected readonly employee = signal<EmployeeSummary | null>(null);
  protected readonly type = signal<ContractType | null>(null);
  protected readonly history = signal<ContractRecord[]>([]);
  protected readonly historyLoaded = signal(false);
  protected readonly archived = signal(false);
  protected readonly action = signal<ContractAction | null>(null);
  protected readonly actionLabels = CONTRACT_ACTIONS;
  protected readonly statuses = CONTRACT_STATUSES;
  protected readonly name = employeeName;
  protected readonly money = contractAmount;
  protected readonly date = formatContractDate;

  protected readonly tab = computed(() => {
    const key = this.query().get('tab');
    return key && this.tabs.some(tab => tab[0] === key) ? key as DetailTab : 'overview';
  });
  protected readonly tabLabel = computed(() => DETAIL_TABS[this.tab()]);
  protected readonly lifecycle = computed(() => {
    const status = this.contract()?.status;
    return status && !LIFECYCLE.includes(status) ? [...LIFECYCLE, status] : LIFECYCLE;
  });
  protected readonly events = computed(() => {
    const accepted = RECORD_TYPES[this.tab()];
    const events = this.history().filter(record => !accepted || accepted.includes(record.type));
    return events.reverse();
  });
  protected readonly actions = computed(() => {
    const contract = this.contract();
    if (!contract) return [];
    const creator = this.history().find(record => record.type === 'CREATED')?.actorUserId;
    const renewalLimit = this.type()?.maxRenewals;
    const remainingRenewals = renewalLimit == null || !this.historyLoaded()
      || this.history().filter(record => record.type === 'RENEWAL').length < renewalLimit;
    const allowed = (Object.keys(CONTRACT_ACTIONS) as ContractAction[]).filter(key => {
      const { states, grant } = CONTRACT_ACTIONS[key];
      return (states as readonly ContractStatus[]).includes(contract.status)
        && this.allowed('contracts.' + grant);
    });
    return allowed.filter(key =>
      (key !== 'renewals' || Boolean(contract.endDate) && remainingRenewals)
      && (key !== 'approve' || creator === undefined || creator !== Number(this.auth.claims()?.sub))
      && (key !== 'archive' || !this.archived() && !this.history().some(record => record.type === 'ARCHIVE')));
  });

  protected get tabs() {
    return (Object.entries(DETAIL_TABS) as [DetailTab, string][]).filter(([key]) => {
      if (key === 'documents') return this.allowed('contracts.documents.read') || this.allowed('contracts.documents.manage');
      if (key === 'employee') return this.allowed('employees.read');
      return key !== 'history' || this.allowed('contracts.history.read');
    });
  }

  ngOnInit() { this.load(); }

  protected allowed(permission: string) { return this.context.permissions.includes(permission); }

  protected load() {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    this.activityError.set('');
    this.employeeError.set('');
    const companyId = this.context.company.id;
    this.api.get(companyId, this.id).pipe(
      switchMap(contract => forkJoin({
        contract: of(contract),
        type: this.api.types(companyId).pipe(catchError(() => of([]))),
        employee: this.allowed('employees.read') ? this.api.employee(companyId, contract.employeeId).pipe(
          catchError(error => { this.employeeError.set(apiErrorMessage(error)); return of(null); }),
        ) : of(null),
        records: this.allowed('contracts.history.read') ? this.api.records(companyId, this.id, 'history').pipe(
          catchError(error => { this.activityError.set(apiErrorMessage(error)); return of(null); }),
        ) : of(null),
      })),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: ({ contract, employee, records, type }) => {
        this.contract.set(contract);
        this.employee.set(employee);
        this.type.set(type.find(entry => entry.code === contract.typeCode) ?? null);
        this.history.set(records ?? []);
        this.historyLoaded.set(records !== null);
        this.loading.set(false);
      },
      error: error => { this.error.set(apiErrorMessage(error)); this.loading.set(false); },
    });
  }

  protected selectAction(action: ContractAction) {
    this.notice.set('');
    this.action.set(action);
  }

  protected finish(action?: ContractAction) {
    if (action === 'archive') this.archived.set(true);
    this.notice.set(action ? 'Contract operation recorded.' : 'Document linked to the contract.');
    this.action.set(null);
    this.load();
  }

  protected trend(record: ContractRecord) {
    if (!record.payload.snapshot) return [];
    const index = this.history().findIndex(entry => entry.id === record.id);
    const previous = this.history().slice(0, index).reverse().find(entry => entry.payload.snapshot)?.payload.snapshot;
    const snapshot = record.payload.snapshot;
    if (!previous) return [];
    const values = [
      { label: 'End date', before: this.date(previous.endDate), after: this.date(snapshot.endDate) },
      { label: 'Compensation', before: this.money(previous.salaryAmount, previous.currency), after: this.money(snapshot.salaryAmount, snapshot.currency) },
      ...Object.entries(TERM_LABELS).map(([key, label]) => ({
        label, before: this.termText(previous.terms[key]), after: this.termText(snapshot.terms[key]),
      })),
    ];
    return values.filter(entry => entry.before !== entry.after);
  }

  protected terms(terms: ContractTerms) {
    return Object.entries(TERM_LABELS).map(([key, label]) => ({ label, value: this.termText(terms[key]) }));
  }

  protected termText(value: unknown) {
    return typeof value === 'string' || typeof value === 'number' ? String(value) || '—' : '—';
  }

  protected recordLabel(type: string) {
    return type.toLowerCase().replaceAll('_', ' ').replace(/^./, char => char.toUpperCase());
  }
}
