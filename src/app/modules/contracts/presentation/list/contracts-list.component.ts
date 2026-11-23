import { Component, DestroyRef, Input, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, firstValueFrom, forkJoin, map, of, switchMap } from 'rxjs';
import { apiErrorMessage } from '../../../../core/api/api-error';
import { ComponentCardComponent } from '../../../../shared/components/common/component-card/component-card.component';
import {
  CLOSED_STATUSES, CONTRACT_STATUSES, CONTRACT_VIEWS, CompanyContext, ContractStatus,
  ContractType, ContractView, Department, EmployeeSummary, EmploymentContract,
} from '../../domain/contracts.models';
import { ContractsApi } from '../../infrastructure/contracts-api.service';
import { contractAmount, employeeName, formatContractDate } from '../format-contract';

const DAY = 86400000;
const PAGE_SIZE = 15;
const VIEW_STATUSES: Partial<Record<ContractView, readonly ContractStatus[]>> = {
  approvals: ['PENDING_APPROVAL'],
  renewals: ['ACTIVE'],
  amendments: ['ACTIVE', 'SUSPENDED'],
  suspensions: ['SUSPENDED', 'ACTIVE'],
  terminations: ['TERMINATED', 'ACTIVE', 'SUSPENDED'],
  archive: CLOSED_STATUSES,
};
const DETAIL_TABS: Partial<Record<ContractView, string>> = {
  renewals: 'renewals', amendments: 'amendments', suspensions: 'suspensions',
  terminations: 'terminations', archive: 'history',
};

@Component({
  selector: 'app-contracts-list',
  standalone: true,
  imports: [FormsModule, RouterLink, ComponentCardComponent],
  templateUrl: './contracts-list.component.html',
})
export class ContractsListComponent implements OnInit {
  @Input({ required: true }) context!: CompanyContext;
  @Input({ required: true }) view!: ContractView;
  private readonly api = inject(ContractsApi);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly exportError = signal('');
  protected readonly supplementalError = signal('');
  protected readonly exporting = signal(false);
  protected readonly rows = signal<EmploymentContract[]>([]);
  protected readonly directory = signal(new Map<string, EmployeeSummary>());
  protected readonly departments = signal<Department[]>([]);
  protected readonly types = signal<ContractType[]>([]);
  protected readonly today = new Date().toISOString().slice(0, 10);
  protected readonly search = signal('');
  protected readonly type = signal('');
  protected readonly status = signal<ContractStatus | ''>('');
  protected readonly department = signal('');
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly order = signal('recent');
  protected readonly expiryDays = signal(30);
  protected readonly page = signal(1);
  protected readonly statuses = CONTRACT_STATUSES;
  protected readonly names = CONTRACT_VIEWS;
  protected readonly formatDate = formatContractDate;
  protected readonly formatAmount = contractAmount;
  protected readonly name = employeeName;

  protected readonly typeNames = computed(() => new Map(this.types().map(type => [type.code, type.name])));
  protected readonly detailTab = computed(() => DETAIL_TABS[this.view] ?? 'overview');
  protected readonly availableStates = computed(() =>
    VIEW_STATUSES[this.view] ?? Object.keys(CONTRACT_STATUSES) as ContractStatus[]);
  protected readonly displayRows = computed(() => {
    const search = this.search().trim().toLocaleLowerCase();
    const status = this.status();
    const type = this.type();
    const department = this.department();
    const from = this.from();
    const to = this.to();
    const order = this.order();
    const expiryDays = this.expiryDays();
    const directory = this.directory();
    const rows = this.rows().filter(contract => {
      const employee = directory.get(contract.employeeId);
      return (!status || contract.status === status)
        && (!type || contract.typeCode === type)
        && (!department || String(employee?.departmentId) === department)
        && (!from || !contract.endDate || contract.endDate >= from)
        && (!to || contract.startDate <= to)
        && (this.view !== 'expiring' || this.daysToEnd(contract) <= expiryDays)
        && (!search || [contract.contractNumber, employee?.employeeNumber, employeeName(employee)]
          .some(value => value?.toLocaleLowerCase().includes(search)));
    });
    if (order === 'number') rows.sort((a, b) => a.contractNumber.localeCompare(b.contractNumber, undefined, { numeric: true }));
    if (order === 'start') rows.sort((a, b) => b.startDate.localeCompare(a.startDate));
    if (order === 'end' || this.view === 'expiring') rows.sort((a, b) => this.daysToEnd(a) - this.daysToEnd(b));
    return rows;
  });
  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.displayRows().length / PAGE_SIZE)));
  protected readonly pageRows = computed(() => this.displayRows().slice((this.page() - 1) * PAGE_SIZE, this.page() * PAGE_SIZE));
  protected readonly metrics = computed(() => {
    const rows = this.rows();
    return [
      { label: 'Total contracts', count: rows.length, view: 'all' },
      { label: 'Active', count: rows.filter(contract => contract.status === 'ACTIVE').length, view: 'all', status: 'ACTIVE' },
      { label: 'Expiring in 30 days', count: rows.filter(contract => this.isExpiring(contract)).length, view: 'expiring' },
      { label: 'Pending approval', count: rows.filter(contract => contract.status === 'PENDING_APPROVAL').length, view: 'approvals' },
      { label: 'Suspended', count: rows.filter(contract => contract.status === 'SUSPENDED').length, view: 'suspensions', status: 'SUSPENDED' },
    ];
  });
  protected readonly distribution = computed(() => {
    const totals = new Map<string, number>();
    for (const contract of this.rows()) totals.set(contract.typeCode, (totals.get(contract.typeCode) ?? 0) + 1);
    return [...totals].sort((a, b) => b[1] - a[1]);
  });
  protected readonly upcoming = computed(() => this.rows().filter(contract => this.isExpiring(contract))
    .sort((a, b) => this.daysToEnd(a) - this.daysToEnd(b)).slice(0, 5));

  ngOnInit() { this.load(); }

  protected load() {
    const companyId = this.context.company.id;
    this.loading.set(true);
    this.error.set('');
    this.supplementalError.set('');
    this.setDefaultStatus();
    const scope = VIEW_STATUSES[this.view];
    const query = scope?.length === 1 ? { status: scope[0] } : {};
    const source = this.view === 'expiring'
      ? this.api.expiring(companyId, 30).pipe(switchMap(result => result.pagination.totalPages > 1
        ? this.api.all(companyId, { status: 'ACTIVE' }).pipe(map(rows => rows.filter(contract => this.isExpiring(contract))))
        : of(result.data)))
      : this.api.all(companyId, query);
    const permissions = this.context.permissions;
    forkJoin({
      contracts: source,
      types: this.soft(this.api.types(companyId)),
      employees: permissions.includes('employees.read') ? this.soft(this.api.employeeDirectory(companyId)) : of(null),
      departments: permissions.includes('organization:read') ? this.soft(this.api.departments(companyId)) : of(null),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ contracts, types, employees, departments }) => {
        this.rows.set(contracts.filter(contract => (!scope || scope.includes(contract.status))
          && (this.view !== 'renewals' || Boolean(contract.endDate))));
        this.types.set(types ?? []);
        this.directory.set(new Map((employees ?? []).map(employee => [employee.id, employee])));
        const listedDepartments = departments ?? [];
        const known = new Set(listedDepartments.map(department => String(department.id)));
        const missing = [...new Set((employees ?? []).flatMap(employee => employee.departmentId ?? []))]
          .filter(id => !known.has(String(id))).map(id => ({ id, name: 'Department #' + id }));
        this.departments.set([...listedDepartments, ...missing]);
        this.page.set(1);
        this.loading.set(false);
      },
      error: error => { this.error.set(apiErrorMessage(error)); this.loading.set(false); },
    });
  }

  private soft<T>(source: import('rxjs').Observable<T>) {
    return source.pipe(catchError(() => {
      this.supplementalError.set('Some reference data could not be loaded. Contract records are still available.');
      return of(null);
    }));
  }

  private setDefaultStatus() {
    const status = this.route.snapshot.queryParamMap.get('status') as ContractStatus | null;
    if (status && this.availableStates().includes(status)) this.status.set(status);
    else if (this.view === 'suspensions') this.status.set('SUSPENDED');
    else if (this.view === 'terminations') this.status.set('TERMINATED');
  }

  protected daysToEnd(contract: EmploymentContract) {
    return contract.endDate ? (Date.parse(contract.endDate) - Date.parse(this.today)) / DAY : Number.POSITIVE_INFINITY;
  }

  private isExpiring(contract: EmploymentContract) {
    const days = this.daysToEnd(contract);
    return contract.status === 'ACTIVE' && days >= 0 && days <= 30;
  }

  protected async exportCsv() {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.exportError.set('');
    try {
      const context = await firstValueFrom(this.api.context(this.context.company.id).pipe(takeUntilDestroyed(this.destroyRef)));
      if (!context.permissions.includes('contracts.export') || !context.permissions.includes('contracts.read')) {
        throw new Error('Your company role does not allow contract exports.');
      }
      const employeeDirectory = context.permissions.includes('employees.read') ? this.directory() : new Map();
      const typeNames = this.typeNames();
      const data = this.displayRows().map(contract => [
        contract.contractNumber, this.name(employeeDirectory.get(contract.employeeId)),
        typeNames.get(contract.typeCode) ?? contract.typeCode, contract.startDate, contract.endDate ?? '',
        contract.salaryAmount ?? '', contract.currency, CONTRACT_STATUSES[contract.status],
      ]);
      const headings = ['Contract', 'Employee', 'Type', 'Start', 'End', 'Salary', 'Currency', 'Status'];
      const csv = [headings, ...data].map(row => row.map(csvCell).join(',')).join('\r\n');
      const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'contracts-' + context.company.id + '.csv';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch (error) {
      if (!this.destroyRef.destroyed) this.exportError.set(apiErrorMessage(error));
    } finally {
      this.exporting.set(false);
    }
  }
}

function csvCell(value: string) {
  const escaped = /^[\s]*[=+\-@]/.test(value) || /^[\t\r\n]/.test(value) ? "'" + value : value;
  return '"' + escaped.replaceAll('"', '""') + '"';
}
