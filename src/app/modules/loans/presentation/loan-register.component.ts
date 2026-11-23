import { DatePipe } from '@angular/common';
import { Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Observable, Subject, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { CompanyWorkspace } from '../../../core/api/company-workspace-api';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { UUID, cents, label, money } from '../domain/loans-format';
import { APPLICATION_STATES, Application, LOAN_TYPES, Loan, LoanPage, LoanQuery } from '../domain/loans.models';
import { hasGrant } from '../domain/loans-sections';
import { LoansApi } from '../infrastructure/loans-api.service';
import { OrganizationMembership } from '../../organization/infrastructure/organization-membership.service';
import { LoanActionComponent, LoanActionResult } from './loan-action.component';
import { LoanApplicationEditorComponent } from './loan-application-editor.component';
import { LoanEmployeePickerComponent } from './loan-employee-picker.component';
import { OrganizationFilterComponent } from '../../organization/presentation/organization-filter.component';

interface Filters { employee: string; status: string; type: string; from: string; to: string; min: string; max: string }
type Row = Application | Loan;
interface RegisterResult { rows: Row[]; total: number; complete?: boolean }
const PAGE_SIZE = 20;

@Component({
  selector: 'app-loan-register',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, ComponentCardComponent, LoanApplicationEditorComponent, LoanEmployeePickerComponent, LoanActionComponent, OrganizationFilterComponent],
  templateUrl: './loan-register.component.html',
})
export class LoanRegisterComponent implements OnInit {
  @Input({ required: true }) context!: CompanyWorkspace;
  @Input({ required: true }) mode!: string;
  @Input({ required: true }) title!: string;
  @Input() initialEmployee = '';
  @Input() applicationFilter = '';
  @Input() initialStatus = '';
  @Input() initialRenegotiation = '';

  private readonly api = inject(LoansApi);
  private readonly organization = inject(OrganizationMembership);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  private readonly reload = new Subject<void>();
  protected readonly result = signal<RegisterResult | null>(null);
  protected readonly employees = signal(new Map<string, string>());
  private readonly requestedEmployees = new Set<string>();
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly filterError = signal('');
  protected readonly notice = signal('');
  protected readonly editing = signal(false);
  protected readonly deciding = signal(false);
  protected readonly label = label;
  protected readonly money = money;
  protected readonly pageSize = PAGE_SIZE;
  protected page = 1;
  protected filters: Filters = { employee: '', status: '', type: '', from: '', to: '', min: '', max: '' };
  protected scope: string[] | null = null;
  private appliedScope: string[] | null = null;
  private applied = { ...this.filters };

  protected get company() { return this.context.company.id; }
  protected get isApplication() { return ['applications', 'approvals', 'advances'].includes(this.mode); }
  protected get canRead() { return this.can(this.isApplication ? 'applications.read' : 'loans.read'); }
  protected get canSearch() { return this.context.permissions.includes('employees.read'); }
  protected get lockedStatus() { return this.mode === 'approvals' || this.mode === 'settlements'; }
  protected get statuses() { return this.isApplication ? APPLICATION_STATES : ['PENDING_DISBURSEMENT', 'ACTIVE', 'SUSPENDED', 'SETTLED']; }
  protected get types() { return this.mode === 'advances' ? LOAN_TYPES.filter(type => type !== 'LOAN') : LOAN_TYPES; }

  ngOnInit() {
    this.filters.employee = UUID.test(this.initialEmployee) ? this.initialEmployee : '';
    if (this.statuses.some(status => status === this.initialStatus)) this.filters.status = this.initialStatus;
    if (this.mode === 'approvals') this.filters.status = 'PENDING_APPROVAL';
    if (this.mode === 'settlements') this.filters.status = 'SETTLED';
    if (this.mode === 'disbursements' && !this.filters.status && !this.applicationFilter) this.filters.status = 'PENDING_DISBURSEMENT';
    if (this.canRead) {
      this.reload.pipe(switchMap(() => {
        this.result.set(null);
        this.error.set('');
        this.loading.set(true);
        return this.read().pipe(map(data => ({ data })), catchError(error => of({ error: apiErrorMessage(error) })));
      }), takeUntilDestroyed(this.destroy)).subscribe(response => {
        this.loading.set(false);
        if ('error' in response) this.error.set(response.error);
        else { this.result.set(response.data); this.identify(this.visible(response.data)); }
      });
      this.apply();
    }
  }

  protected can(grant: string) { return hasGrant(this.context.permissions, grant); }
  protected application(row: Row): row is Application { return 'loanType' in row; }
  protected retry() { this.reload.next(); }

  protected apply() {
    const { employee, from, to, min, max } = this.filters;
    const low = cents(min);
    const high = cents(max);
    const message = employee && !UUID.test(employee) ? 'Enter a valid employee ID.'
      : from && to && from > to ? 'The start date must be on or before the end date.'
      : (min && low === null) || (max && high === null) || (low !== null && high !== null && low > high)
        ? 'Enter a valid amount range.' : '';
    this.filterError.set(message);
    if (message) return;
    this.applied = { ...this.filters };
    this.appliedScope = this.scope;
    this.page = 1;
    this.reload.next();
  }

  protected go(page: number) {
    this.page = page;
    const data = this.result();
    if (data?.complete) this.identify(this.visible(data));
    else this.reload.next();
  }

  protected visible(data: RegisterResult) {
    return data.complete ? data.rows.slice((this.page - 1) * PAGE_SIZE, this.page * PAGE_SIZE) : data.rows;
  }

  protected saved(record: Application) {
    this.editing.set(false);
    if (this.canRead) void this.router.navigate(['/loans', this.company, 'applications', record.id]);
    else this.notice.set('Draft saved. Application ID ' + record.id);
  }

  protected decided(result: LoanActionResult) {
    this.deciding.set(false);
    this.notice.set(result.message + (result.renegotiation ? ' ' + label(result.renegotiation.status) + ' · ' + result.renegotiation.id : ''));
    if (this.canRead) this.retry();
  }

  private read(): Observable<RegisterResult> {
    const filter = this.applied;
    const query: LoanQuery = { ...(filter.employee ? { employeeId: filter.employee } : {}), ...(filter.status ? { status: filter.status } : {}) };
    const get = (page: number, limit?: number): Observable<LoanPage<Row>> => this.isApplication
      ? this.api.applications(this.company, query, page, limit) : this.api.loans(this.company, query, page, limit);
    const linked = UUID.test(this.applicationFilter);
    const activeOnly = this.mode === 'active' && !filter.status && !linked;
    if (!activeOnly && this.mode !== 'advances' && !linked && !filter.type && !filter.from && !filter.to && !filter.min && !filter.max && !this.appliedScope) {
      return get(this.page).pipe(map(result => ({ rows: result.data, total: result.total })));
    }
    const low = cents(filter.min);
    const high = cents(filter.max);
    const rows = activeOnly
      ? forkJoin(['ACTIVE', 'SUSPENDED'].map(status => this.api.all(page => this.api.loans(this.company, { ...query, status }, page, 100))))
        .pipe(map(pages => pages.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt))))
      : this.api.all(page => get(page, 100));
    return forkJoin({
      rows,
      employees: this.organization.employees(this.company, this.appliedScope),
    }).pipe(map(({ rows, employees }) => rows.filter(row => {
      const application = this.application(row);
      const raw = application ? row.requestedAmount : row.principalAmount;
      const value = cents(raw);
      const date = row.createdAt.slice(0, 10);
      return (!employees || employees.has(row.employeeId)) && (!activeOnly || ['ACTIVE', 'SUSPENDED'].includes(row.status))
        && (this.mode !== 'advances' || (application && row.loanType !== 'LOAN'))
        && (!linked || (!application && row.applicationId === this.applicationFilter))
        && (!filter.type || (application && row.loanType === filter.type))
        && (!filter.from || date >= filter.from) && (!filter.to || date <= filter.to)
        && (low === null || (value !== null && value >= low)) && (high === null || (value !== null && value <= high));
    })), map(rows => ({ rows, total: rows.length, complete: true })));
  }

  private identify(rows: Row[]) {
    if (!this.canSearch) return;
    for (const row of rows) {
      if (this.requestedEmployees.has(row.employeeId)) continue;
      this.requestedEmployees.add(row.employeeId);
      this.api.employee(this.company, row.employeeId).pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: employee => this.employees.update(current => new Map(current).set(employee.id,
          employee.firstName + ' ' + employee.lastName + ' · ' + employee.employeeNumber)),
        error: () => this.requestedEmployees.delete(row.employeeId),
      });
    }
  }
}
