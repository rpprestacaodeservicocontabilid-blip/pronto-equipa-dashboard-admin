import { DatePipe } from '@angular/common';
import { Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Observable, Subject, catchError, map, of, switchMap } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { CompanyWorkspace } from '../../../core/api/company-workspace-api';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { AuthSessionStore } from '../../auth/application/auth-session.store';
import { TODAY, UUID, cents, human, money } from '../domain/salary-format';
import { Assignment, Page, Query, Revision, Simulation } from '../domain/salary.models';
import { can } from '../domain/salary-sections';
import { SalaryApi, SalaryEmployee } from '../infrastructure/salary-api.service';
import { SalaryFieldComponent } from './salary-field.component';
import { SalaryFormComponent } from './salary-form.component';
import { SalaryForm, identity, string } from './salary-form';
import { employeeField, overrideFields, payDate, payFields, payInput, reasonField } from './salary-pay-forms';

type Row = Assignment | Revision;
type View = { rows: Row[]; total: number; local?: boolean; detail?: Row };
const STATES = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'APPLIED'];

@Component({
  selector: 'app-salary-people',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, ComponentCardComponent, SalaryFormComponent, SalaryFieldComponent],
  templateUrl: './salary-people.component.html',
})
export class SalaryPeopleComponent implements OnInit {
  @Input({ required: true }) context!: CompanyWorkspace;
  @Input({ required: true }) mode!: 'assignments' | 'revisions';
  @Input() id = '';
  @Input() initialEmployee = '';
  @Input() initialStatus = '';
  private readonly api = inject(SalaryApi);
  private readonly auth = inject(AuthSessionStore);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  private readonly reload = new Subject<void>();
  protected readonly data = signal<View | null>(null);
  protected readonly editor = signal<SalaryForm | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly filterError = signal('');
  protected readonly notice = signal('');
  protected readonly preview = signal<Simulation | null>(null);
  protected readonly previewError = signal('');
  protected readonly previewBusy = signal(false);
  protected readonly employees = signal(new Map<string, SalaryEmployee>());
  private readonly employeeReads = new Set<string>();
  protected readonly money = money;
  protected readonly human = human;
  protected readonly employeeField = { ...employeeField, required: false };
  protected readonly states = STATES;
  protected page = 1;
  protected filter = { employee: '', status: '', from: '', to: '' };
  private applied = { ...this.filter };
  private target: 'assignments' | 'revisions' | undefined;
  protected get company() { return this.context.company.id; }
  protected get canRead() { return this.can(this.mode + ':read'); }
  protected get canCreate() { return this.can(this.mode === 'assignments' ? 'assignments:manage' : 'revisions:create'); }
  protected can(grant: string) { return can(this.context.permissions, grant); }
  protected isRevision(row: Row): row is Revision { return 'proposedData' in row; }
  protected own(revision: Revision) { return String(revision.requestedBy) === this.auth.claims()?.sub; }
  protected setEmployee(value: string | boolean) { this.filter.employee = String(value); }

  ngOnInit() {
    if (!this.canRead) return;
    this.filter.employee = UUID.test(this.initialEmployee) ? this.initialEmployee : '';
    this.filter.status = STATES.includes(this.initialStatus) && this.mode === 'revisions' ? this.initialStatus : '';
    this.reload.pipe(switchMap(() => {
      this.loading.set(true);
      this.error.set('');
      this.data.set(null);
      this.preview.set(null);
      this.previewError.set('');
      return this.read().pipe(map(data => ({ data })), catchError(error => of({ error: apiErrorMessage(error) })));
    }), takeUntilDestroyed(this.destroy)).subscribe(result => {
      this.loading.set(false);
      if ('error' in result) this.error.set(result.error);
      else {
        this.data.set(result.data);
        this.identify(result.data.detail ? [result.data.detail] : this.visible(result.data));
      }
    });
    this.apply();
  }
  protected refresh() { this.reload.next(); }
  protected apply() {
    const { employee, from, to } = this.filter;
    const issue = employee && !UUID.test(employee) ? 'Enter a valid employee ID.' : from && to && from > to ? 'The start date must be on or before the end date.' : '';
    this.filterError.set(issue);
    if (issue) return;
    this.applied = { ...this.filter };
    this.page = 1;
    this.refresh();
  }
  protected go(page: number) {
    this.page = page;
    const view = this.data();
    if (view?.local) this.identify(this.visible(view)); else this.refresh();
  }
  protected visible(view: View) { return view.local ? view.rows.slice((this.page - 1) * 20, this.page * 20) : view.rows; }
  protected payState(item: Assignment) {
    if (item.status !== 'ACTIVE') return human(item.status);
    const today = TODAY();
    return item.effectiveFrom > today ? 'Future' : item.effectiveTo && item.effectiveTo < today ? 'Historical' : 'Current';
  }
  protected change(revision: Revision) {
    if (!revision.previousAssignment || revision.previousAssignment.currency !== revision.proposedData.currency) return '—';
    const previous = cents(revision.previousAssignment.baseSalary);
    const proposed = cents(revision.proposedData.baseSalary);
    return previous === null || proposed === null ? '—' : money(proposed - previous, revision.proposedData.currency);
  }
  protected employeeName(id: string) {
    const person = this.employees().get(id);
    return person ? person.firstName + ' ' + person.lastName + ' · ' + person.employeeNumber : id;
  }
  protected simulate(revision: Revision) {
    if (this.previewBusy() || this.editor() || !this.can('simulations:run')) return;
    const { baseSalary, currency, structureVersionId, components } = revision.proposedData;
    this.preview.set(null);
    this.previewError.set('');
    this.previewBusy.set(true);
    this.api.simulate(this.company, {
      baseSalary: String(baseSalary), currency, structureVersionId, components, effectiveDate: revision.effectiveFrom,
    }).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: data => { this.preview.set(data); this.previewBusy.set(false); },
      error: error => { this.previewError.set(apiErrorMessage(error)); this.previewBusy.set(false); },
    });
  }

  private identify(rows: Row[]) {
    if (!this.context.permissions.includes('employees.read')) return;
    for (const row of rows) {
      if (this.employeeReads.has(row.employeeId)) continue;
      this.employeeReads.add(row.employeeId);
      this.api.employee(this.company, row.employeeId).pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: person => this.employees.update(current => new Map(current).set(person.id, person)),
        error: () => this.employeeReads.delete(row.employeeId),
      });
    }
  }

  protected create(previous?: Assignment) {
    this.notice.set('');
    const revision = !!previous || this.mode === 'revisions';
    this.target = revision ? 'revisions' : 'assignments';
    const previousPay = previous ? { baseSalary: previous.baseSalary, currency: previous.currency, structureVersionId: previous.structureVersionId ?? '' } : undefined;
    this.editor.set({
      title: revision ? 'Propose salary revision' : 'Create salary assignment',
      description: 'The server validates contract, currency, effective dates and the published structure.',
      fields: [
        { ...employeeField, initial: previous?.employeeId }, payDate(),
        revision ? identity('previousAssignmentId', 'Previous assignment ID', undefined, previous?.id) : identity('contractId', 'Employment contract ID', 'contract'),
        ...payFields(previousPay), ...(revision ? [reasonField] : []),
      ],
      group: { title: 'Individual component overrides', fields: overrideFields,
        rows: previous?.components?.map(line => ({
          componentVersionId: line.componentVersionId, amount: String(line.amount ?? ''), sourceReference: line.sourceReference ?? '',
          percentage: typeof line.calculationConfig['percentage'] === 'string' ? line.calculationConfig['percentage'] : '',
          condition: typeof line.calculationConfig['enabled'] === 'boolean' ? (line.calculationConfig['enabled'] ? 'ENABLED' : 'DISABLED') : 'DEFAULT',
          originalConfig: JSON.stringify(line.calculationConfig),
        })),
      },
      confirm: revision ? undefined : 'I have reviewed the contract and confirm this effective-dated assignment.',
      submitLabel: revision ? 'Save draft revision' : 'Save assignment',
      send: (values, rows) => {
        const employeeId = string(values, 'employeeId').toLowerCase();
        const effectiveFrom = string(values, 'effectiveFrom');
        const pay = payInput(values, rows);
        if (revision) return this.api.post(this.company, 'revisions', {
          employeeId, effectiveFrom, previousAssignmentId: string(values, 'previousAssignmentId'), reason: string(values, 'reason'), proposedData: pay,
        });
        const contractId = string(values, 'contractId');
        const assign = () => this.api.post(this.company, 'assignments', { employeeId, effectiveFrom, contractId, ...pay });
        if (!this.context.permissions.includes('contracts.read')) return assign();
        return this.api.contract(this.company, contractId).pipe(switchMap(contract => {
          if (contract.employeeId !== employeeId || contract.status !== 'ACTIVE' || contract.startDate > effectiveFrom ||
              (contract.endDate && contract.endDate < effectiveFrom)) throw new Error('Select an active contract for this employee and effective date.');
          if (contract.currency !== pay.currency || (contract.salaryAmount != null && cents(contract.salaryAmount) !== cents(pay.baseSalary))) {
            throw new Error('The currency and base salary must match the active employment contract.');
          }
          return assign();
        }));
      },
    });
  }

  protected action(row: Revision, operation: 'submit' | 'approve' | 'reject' | 'apply') {
    const title = { submit: 'Submit revision', approve: 'Approve revision', reject: 'Reject revision', apply: 'Apply revision' }[operation];
    const decision = operation === 'approve' || operation === 'reject';
    this.editor.set({
      title, description: 'Effective from ' + row.effectiveFrom,
      fields: decision ? [{ ...reasonField, required: operation === 'reject' }] : [],
      confirm: 'I have reviewed the previous and proposed pay and confirm this action.',
      submitLabel: title,
      send: values => this.api.post(this.company, 'revisions/' + encodeURIComponent(row.id) + '/' + (decision ? 'decision' : operation),
        decision ? { decision: operation === 'approve' ? 'APPROVED' : 'REJECTED', reason: string(values, 'reason') || undefined }
          : operation === 'apply' ? { idempotencyKey: 'admin-apply:' + row.id } : {}),
    });
  }

  protected cancel() { this.editor.set(null); this.target = undefined; }
  protected saved(result: unknown) {
    const target = this.target;
    this.cancel();
    const id = (result as { id?: string } | null)?.id;
    this.notice.set('Saved successfully.' + (target && id && !this.can(target + ':read') ? ' Reference ' + id : ''));
    if (target && id && this.can(target + ':read')) { void this.router.navigate(['/salary-structure', this.company, target, id]); return; }
    this.refresh();
  }

  private read(): Observable<View> {
    if (this.id) {
      if (!UUID.test(this.id)) return of({ rows: [], total: 0 });
      const request: Observable<Row> = this.mode === 'assignments' ? this.api.assignment(this.company, this.id) : this.api.revision(this.company, this.id);
      return request.pipe(map(detail => ({ detail, rows: [], total: 1 })));
    }
    const { employee, status, from, to } = this.applied;
    const query: Query = { ...(employee ? { employeeId: employee } : {}), ...(this.mode === 'revisions' && status ? { status } : {}) };
    const get = (page: number, limit: number): Observable<Page<Row>> => this.api.page<Row>(this.company, this.mode, query, page, limit);
    const scope = this.mode === 'assignments' && status;
    if (!from && !to && !scope) return get(this.page, 20).pipe(map(result => ({ rows: result.data, total: result.total })));
    return this.api.all(page => get(page, 100)).pipe(map(rows => rows.filter(row =>
      (!from || row.effectiveFrom >= from) && (!to || row.effectiveFrom <= to) &&
      (!scope || !this.isRevision(row) && this.payState(row) === status))),
      map(rows => ({ rows, total: rows.length, local: true })));
  }
}
