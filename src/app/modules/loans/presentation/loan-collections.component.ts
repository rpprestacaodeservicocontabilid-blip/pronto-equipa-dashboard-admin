import { Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, Subject, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { CompanyWorkspace } from '../../../core/api/company-workspace-api';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { ReportCell, downloadWorkbook, printReport } from '../../../shared/utils/report-documents';
import { UUID, cents, decimal, label, money, today, validDate } from '../domain/loans-format';
import { Deduction, Installment, Loan, LoanPage, LoanSummary } from '../domain/loans.models';
import { hasGrant } from '../domain/loans-sections';
import { LoansApi } from '../infrastructure/loans-api.service';
import { OrganizationMembership } from '../../organization/infrastructure/organization-membership.service';
import { LoanActionComponent, LoanActionResult } from './loan-action.component';
import { LoanEmployeePickerComponent } from './loan-employee-picker.component';
import { OrganizationFilterComponent } from '../../organization/presentation/organization-filter.component';

type Report = 'summary' | 'outstanding' | 'overdue' | 'deductions' | 'granted' | 'settled';
type Row = Installment | Deduction | Loan;
type View = { rows: Row[]; total: number; summary?: LoanSummary; complete?: boolean };
interface Filters { from: string; to: string; employee: string; loanId: string; status: string; min: string; max: string }

const OPTIONS: { report: Report; title: string; grant?: string }[] = [
  { report: 'summary', title: 'Company loan summary' },
  { report: 'outstanding', title: 'Outstanding balances by employee' },
  { report: 'overdue', title: 'Overdue installments' },
  { report: 'deductions', title: 'Payroll deductions', grant: 'deductions.read' },
  { report: 'granted', title: 'Loans disbursed', grant: 'loans.read' },
  { report: 'settled', title: 'Settled loans', grant: 'loans.read' },
];

@Component({
  selector: 'app-loan-collections',
  standalone: true,
  imports: [FormsModule, RouterLink, ComponentCardComponent, LoanActionComponent, LoanEmployeePickerComponent, OrganizationFilterComponent],
  templateUrl: './loan-collections.component.html',
})
export class LoanCollectionsComponent implements OnInit {
  @Input({ required: true }) context!: CompanyWorkspace;
  @Input({ required: true }) mode!: 'reports' | 'overdue' | 'deductions';
  @Input() initialLoan = '';
  @Input() initialFrom = '';
  @Input() initialTo = '';
  @Input() initialReport = '';
  @Input() confirmedOnly = false;

  private readonly api = inject(LoansApi);
  private readonly organization = inject(OrganizationMembership);
  private readonly destroy = inject(DestroyRef);
  private readonly reload = new Subject<void>();
  protected readonly data = signal<View | null>(null);
  protected readonly error = signal('');
  protected readonly filterError = signal('');
  protected readonly busy = signal(false);
  protected readonly exporting = signal(false);
  protected readonly pending = signal<Deduction | null>(null);
  protected readonly notice = signal('');
  protected readonly money = money;
  protected readonly label = label;
  protected readonly states = ['REQUESTED', 'CONFIRMED', 'PARTIAL', 'REJECTED', 'REVERSED'];
  protected readonly pageSize = 20;
  protected page = 1;
  protected report: Report = 'summary';
  protected filters: Filters = { from: '', to: '', employee: '', loanId: '', status: '', min: '', max: '' };
  protected scope: string[] | null = null;
  private appliedScope: string[] | null = null;
  private applied = { ...this.filters };
  private readonly day = today();

  protected get company() { return this.context.company.id; }
  protected get reports() { return OPTIONS.filter(option => !option.grant || this.can(option.grant)); }
  protected get title() { return OPTIONS.find(option => option.report === this.report)!.title; }
  protected get byEmployee() { return this.report === 'outstanding' || this.report === 'granted' || this.report === 'settled'; }

  ngOnInit() {
    this.report = this.mode === 'reports' ? this.reports.find(option => option.report === this.initialReport)?.report ?? 'summary' : this.mode;
    this.filters.loanId = UUID.test(this.initialLoan) ? this.initialLoan : '';
    this.filters.from = validDate(this.initialFrom) ? this.initialFrom : '';
    this.filters.to = validDate(this.initialTo) ? this.initialTo : '';
    if (this.report === 'deductions' && this.confirmedOnly) this.filters.status = 'APPLIED';
    this.reload.pipe(switchMap(() => {
      this.busy.set(true);
      this.error.set('');
      this.data.set(null);
      const operation: Observable<View> = this.report === 'summary'
        ? this.api.summary(this.company).pipe(map(summary => ({ rows: [], total: 0, summary })))
        : this.read(false);
      return operation.pipe(map(data => ({ data })), catchError(error => of({ error: apiErrorMessage(error) })));
    }), takeUntilDestroyed(this.destroy)).subscribe(result => {
      this.busy.set(false);
      if ('error' in result) this.error.set(result.error);
      else this.data.set(result.data);
    });
    this.apply();
  }

  protected can(grant: string) { return hasGrant(this.context.permissions, grant); }
  protected retry() { this.reload.next(); }
  protected isDeduction(row: Row): row is Deduction { return 'requestedAmount' in row; }
  protected isInstallment(row: Row): row is Installment { return 'dueDate' in row; }
  protected totalDue(row: Installment) { return (cents(row.principalDue) ?? 0n) + (cents(row.interestDue) ?? 0n); }
  protected age(row: Installment) { return Math.max(0, Math.round((Date.parse(this.day) - Date.parse(row.dueDate)) / 86_400_000)); }
  protected ageBand(row: Installment) {
    const days = this.age(row);
    return days <= 30 ? '1–30 days' : days <= 60 ? '31–60 days' : days <= 90 ? '61–90 days' : 'Over 90 days';
  }

  protected chooseReport(report: Report) {
    this.report = report;
    this.filters = { from: '', to: '', employee: '', loanId: '', status: '', min: '', max: '' };
    if (!this.byEmployee) this.scope = null;
    this.apply();
  }

  protected apply() {
    const { employee, loanId, from, to, min, max } = this.filters;
    const low = cents(min);
    const high = cents(max);
    const invalid = (employee && !UUID.test(employee)) || (loanId && !UUID.test(loanId)) ? 'Enter a valid record ID.'
      : from && to && from > to ? 'The start date must be on or before the end date.'
      : (min && low === null) || (max && high === null) || (low !== null && high !== null && low > high) ? 'Enter a valid amount range.' : '';
    this.filterError.set(invalid);
    if (invalid) return;
    this.applied = { ...this.filters };
    this.appliedScope = this.byEmployee ? this.scope : null;
    this.page = 1;
    this.retry();
  }

  protected go(page: number) { this.page = page; if (!this.data()?.complete) this.retry(); }
  protected visible(view: View) { return view.complete ? view.rows.slice((this.page - 1) * this.pageSize, this.page * this.pageSize) : view.rows; }
  protected confirmed(result: LoanActionResult) { this.notice.set(result.message); this.pending.set(null); this.retry(); }

  protected export(view: View, kind: 'excel' | 'pdf') {
    if (this.exporting()) return;
    if (view.summary || view.complete || view.total <= view.rows.length) {
      this.document(view, kind);
      return;
    }
    this.exporting.set(true);
    this.error.set('');
    this.read(true).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: data => { this.exporting.set(false); this.document(data, kind); },
      error: error => { this.exporting.set(false); this.error.set(apiErrorMessage(error)); },
    });
  }

  private read(all: boolean): Observable<View> {
    const filter = this.applied;
    const report = this.report;
    const get = (page: number, limit: number): Observable<LoanPage<Row>> => {
      switch (report) {
        case 'deductions':
          return this.api.deductions(this.company, { ...(filter.loanId ? { loanId: filter.loanId } : {}), ...(filter.status ? { status: filter.status } : {}) }, page, limit);
        case 'overdue':
          return this.api.overdue(this.company, page, limit);
        case 'outstanding':
          return this.api.outstanding(this.company, page, limit);
        default:
          return this.api.loans(this.company, { ...(filter.employee ? { employeeId: filter.employee } : {}), ...(report === 'settled' ? { status: 'SETTLED' } : {}) }, page, limit);
      }
    };
    const local = !!(filter.from || filter.to || filter.min || filter.max || filter.employee || (filter.loanId && report === 'overdue') || report === 'granted');
    const appliedOnly = report === 'deductions' && filter.status === 'APPLIED';
    if (!all && !local && !appliedOnly && !this.appliedScope) return get(this.page, this.pageSize).pipe(map(page => ({ rows: page.data, total: page.total })));
    const low = cents(filter.min);
    const high = cents(filter.max);
    const records = appliedOnly
      ? forkJoin(['CONFIRMED', 'PARTIAL'].map(status => this.api.all(page =>
        this.api.deductions(this.company, { ...(filter.loanId ? { loanId: filter.loanId } : {}), status }, page, 100),
      ))).pipe(map(results => results.flat().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))))
      : this.api.all(page => get(page, 100));
    return forkJoin({ rows: records, employees: this.organization.employees(this.company, this.appliedScope) }).pipe(map(({ rows, employees }) => rows.filter(row => {
      if (report === 'granted' && !('disbursedAt' in row && row.disbursedAt)) return false;
      let date: string;
      let monetary: bigint | null;
      if (this.isDeduction(row)) {
        date = row.updatedAt.slice(0, 10);
        monetary = cents(row.requestedAmount);
      } else if (this.isInstallment(row)) {
        if (filter.loanId && row.loanId !== filter.loanId) return false;
        date = row.dueDate;
        monetary = this.totalDue(row);
      } else {
        if (filter.employee && row.employeeId !== filter.employee) return false;
        if (employees && !employees.has(row.employeeId)) return false;
        date = (report === 'settled' ? row.updatedAt : row.disbursedAt ?? row.createdAt).slice(0, 10);
        monetary = cents(report === 'outstanding' ? row.balance.total : row.principalAmount);
      }
      return (!filter.from || date >= filter.from) && (!filter.to || date <= filter.to)
        && (low === null || (monetary !== null && monetary >= low)) && (high === null || (monetary !== null && monetary <= high));
    })), map(rows => ({ rows, total: rows.length, complete: true })));
  }

  private document(view: View, kind: 'excel' | 'pdf') {
    let headings: string[];
    let rows: ReportCell[][];
    if (view.summary) {
      headings = ['Active and suspended loans', 'Outstanding principal (Kz)', 'Outstanding interest (Kz)', 'Outstanding total (Kz)'];
      rows = [[view.summary.activeLoans, { amount: view.summary.outstandingPrincipal }, { amount: view.summary.outstandingInterest }, { amount: view.summary.outstandingTotal }]];
    } else if (this.report === 'deductions') {
      headings = ['Loan ID', 'Installment ID', 'Status', 'Requested (Kz)', 'Confirmed (Kz)', 'Payroll run', 'Updated'];
      rows = view.rows.filter(this.isDeduction).map(row => [row.loanId, row.installmentId, label(row.status),
        { amount: row.requestedAmount }, row.confirmedAmount ? { amount: row.confirmedAmount } : null, row.payrollRunId, row.updatedAt]);
    } else if (this.report === 'overdue') {
      headings = ['Loan ID', 'Installment', 'Due date', 'Age', 'Status', 'Scheduled due (Kz)'];
      rows = view.rows.filter(this.isInstallment).map(row => [row.loanId, row.installmentNumber, row.dueDate, this.ageBand(row), label(row.status), { amount: decimal(this.totalDue(row)) }]);
    } else {
      headings = ['Loan reference', 'Employee ID', 'Status', 'Principal granted (Kz)', 'Outstanding principal (Kz)', 'Outstanding interest (Kz)', 'Reconciled balance (Kz)', 'Disbursed', 'Last updated'];
      rows = view.rows.filter((row): row is Loan => 'balance' in row).map(row => [row.loanNumber, row.employeeId, label(row.status),
        { amount: row.principalAmount }, { amount: row.balance.principal }, { amount: row.balance.interest }, { amount: row.balance.total }, row.disbursedAt, row.updatedAt]);
    }
    const report = { title: this.title, company: this.context.company.name, headings, rows };
    if (kind === 'excel') downloadWorkbook('loans-' + this.report, report);
    else printReport(report, money);
  }
}
