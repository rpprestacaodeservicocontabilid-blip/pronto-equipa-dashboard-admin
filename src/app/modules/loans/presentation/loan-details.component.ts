import { DatePipe } from '@angular/common';
import { Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Observable, Subject, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { CompanyWorkspace } from '../../../core/api/company-workspace-api';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { ReportCell, downloadWorkbook, printReport } from '../../../shared/utils/report-documents';
import { UUID, cents, label, money } from '../domain/loans-format';
import { Application, Disbursement, Employee, Installment, Loan, LoanHistory, Plan, Renegotiation, Repayment } from '../domain/loans.models';
import { hasGrant } from '../domain/loans-sections';
import { LoansApi } from '../infrastructure/loans-api.service';
import { LoanActionComponent, LoanActionRequest, LoanActionResult } from './loan-action.component';
import { LoanInstallmentsComponent } from './loan-installments.component';

interface LoanView {
  loan: Loan;
  employee?: Employee;
  application?: Application;
  plans?: Plan[];
  installments?: Installment[];
  disbursements?: Disbursement[];
  repayments?: Repayment[];
  history?: LoanHistory;
  relatedErrors: string[];
}

@Component({
  selector: 'app-loan-details',
  standalone: true,
  imports: [DatePipe, RouterLink, RouterLinkActive, ComponentCardComponent, LoanActionComponent, LoanInstallmentsComponent],
  templateUrl: './loan-details.component.html',
})
export class LoanDetailsComponent implements OnInit {
  @Input({ required: true }) context!: CompanyWorkspace;
  @Input({ required: true }) id!: string;
  @Input({ required: true }) mode!: string;
  private readonly api = inject(LoansApi);
  private readonly destroy = inject(DestroyRef);
  private readonly reload = new Subject<void>();
  protected readonly view = signal<LoanView | null>(null);
  protected readonly pending = signal<LoanActionRequest | null>(null);
  protected readonly renegotiation = signal<Renegotiation | null>(null);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly loading = signal(false);
  protected readonly label = label;
  protected readonly money = money;
  protected get company() { return this.context.company.id; }
  protected can(grant: string) { return hasGrant(this.context.permissions, grant); }
  protected get tabs() {
    return [
      { mode: 'active', title: 'Loan overview', available: true },
      { mode: 'repayment-plans', title: 'Plans', available: true },
      { mode: 'installments', title: 'Installments', available: true },
      { mode: 'disbursements', title: 'Disbursements', available: this.can('disbursements.read') || this.can('disbursements.request') },
      { mode: 'repayments', title: 'Repayments', available: this.can('repayments.read') || this.can('repayments.register') },
      { mode: 'renegotiations', title: 'Renegotiations', available: this.can('renegotiations.request') || this.can('renegotiations.decide') },
      { mode: 'settlements', title: 'Settlement', available: true },
    ].filter(tab => tab.available);
  }

  ngOnInit() {
    if (!this.can('loans.read')) { this.error.set('Your role does not include access to loans.'); return; }
    if (!UUID.test(this.id)) { this.error.set('Invalid loan reference.'); return; }
    this.reload.pipe(switchMap(() => {
      this.loading.set(true);
      this.error.set('');
      this.view.set(null);
      return this.api.loan(this.company, this.id).pipe(
        switchMap(loan => this.details(loan)), map(data => ({ data })),
        catchError(error => of({ error: apiErrorMessage(error) })),
      );
    }), takeUntilDestroyed(this.destroy)).subscribe(response => {
      this.loading.set(false);
      if ('error' in response) this.error.set(response.error);
      else this.view.set(response.data);
    });
    this.retry();
  }

  protected retry() { this.reload.next(); }
  protected employeeName(data: LoanView) {
    return data.employee ? data.employee.firstName + ' ' + data.employee.lastName + ' · ' + data.employee.employeeNumber : data.loan.employeeId;
  }
  protected nextInstallment(data: LoanView) {
    return data.installments?.find(item => ['PENDING', 'PARTIALLY_PAID'].includes(item.status));
  }
  protected isCollecting(loan: Loan) { return ['ACTIVE', 'SUSPENDED'].includes(loan.status); }
  protected zeroBalance(loan: Loan) { return cents(loan.balance.total) === 0n; }
  protected amortized(loan: Loan) {
    return (cents(loan.principalAmount) ?? 0n) - (cents(loan.balance.principal) ?? 0n);
  }
  protected showDisbursement(data: LoanView) {
    return data.loan.status === 'PENDING_DISBURSEMENT' && this.can('disbursements.request')
      && (!this.can('disbursements.read') || !!data.disbursements && !data.disbursements.some(item => item.status === 'REQUESTED'));
  }
  protected failedDisbursement(data: LoanView) { return data.disbursements?.find(item => item.status === 'FAILED')?.id; }

  protected begin(request: LoanActionRequest) { this.notice.set(''); this.pending.set(request); }

  protected completed(result: LoanActionResult) {
    this.notice.set(result.message);
    if (result.renegotiation) this.renegotiation.set(result.renegotiation);
    this.pending.set(null);
    this.retry();
  }

  protected settlementStatement(data: LoanView) {
    const loan = data.loan;
    if (loan.status !== 'SETTLED' || !this.zeroBalance(loan)) return;
    printReport({
      title: 'Loan settlement statement', company: this.context.company.name,
      note: 'Statement generated from the reconciled loan record on ' + new Date().toLocaleDateString() + '.',
      headings: ['Field', 'Value'],
      rows: [
        ['Loan reference', loan.loanNumber], ['Employee', this.employeeName(data)], ['Status', label(loan.status)],
        ['Principal granted', { amount: loan.principalAmount, currency: loan.currency }],
        ['Reconciled balance', { amount: loan.balance.total, currency: loan.currency }],
        ['Last recorded update', loan.updatedAt],
      ],
    }, money);
  }

  protected hasExport(data: LoanView) {
    return this.can('reports.read') && !!(data.plans?.length || data.installments?.length ||
      data.disbursements?.length || data.repayments?.length || data.history?.ledger.length);
  }

  protected exportRecord(data: LoanView, format: 'pdf' | 'excel') {
    if (!this.hasExport(data)) return;
    const { loan } = data;
    const value = (amount: string) => ({ amount, currency: loan.currency });
    let headings: string[];
    let rows: ReportCell[][];
    if (this.mode === 'repayment-plans' && data.plans) {
      headings = ['Plan version', 'Plan status', 'Installment', 'Due date', 'Principal (Kz)', 'Interest (Kz)', 'Status'];
      rows = data.plans.flatMap(plan => plan.installments.map(row => [
        plan.version, label(plan.status), row.installmentNumber, row.dueDate, value(row.principalDue), value(row.interestDue), label(row.status),
      ]));
    } else if (this.mode === 'installments' && data.installments) {
      headings = ['Installment', 'Due date', 'Principal (Kz)', 'Interest (Kz)', 'Confirmed paid (Kz)', 'Status'];
      rows = data.installments.map(row => [row.installmentNumber, row.dueDate, value(row.principalDue),
        value(row.interestDue), row.paid ? value(row.paid.total) : null, label(row.status)]);
    } else if (this.mode === 'disbursements' && data.disbursements) {
      headings = ['Created', 'Status', 'Amount (Kz)', 'Payment reference', 'Confirmed', 'User'];
      rows = data.disbursements.map(row => [row.createdAt, label(row.status), value(row.amount), row.paymentReference, row.confirmedAt, row.createdBy]);
    } else if (this.mode === 'repayments' && data.repayments) {
      headings = ['Created', 'Status', 'Amount (Kz)', 'Source', 'Payment reference', 'User'];
      rows = data.repayments.map(row => [row.createdAt, label(row.status), value(row.amount), label(row.source), row.externalReference, row.createdBy]);
    } else if (data.history) {
      headings = ['Date', 'Movement', 'Principal (Kz)', 'Interest (Kz)', 'Source', 'Reference', 'User'];
      rows = data.history.ledger.map(row => [row.occurredAt, label(row.entryType), value(row.principalAmount),
        value(row.interestAmount), label(row.source), row.externalReference, row.createdBy]);
    } else return;
    const title = loan.loanNumber + ' · ' + (this.mode === 'active' ? 'Financial ledger' : label(this.mode.replaceAll('-', '_')));
    const report = { title, company: this.context.company.name, headings, rows };
    if (format === 'excel') downloadWorkbook('loan-' + this.mode, report);
    else printReport(report, money);
  }

  private details(loan: Loan) {
    const errors: string[] = [];
    const optional = <T>(request: Observable<T>, title: string) => request.pipe(catchError(error => {
      errors.push(title + ' · ' + apiErrorMessage(error));
      return of(undefined);
    }));
    return forkJoin({
      employee: this.context.permissions.includes('employees.read') ? optional(this.api.employee(this.company, loan.employeeId), 'Employee') : of(undefined),
      application: this.can('applications.read') && this.mode === 'active'
        ? optional(this.api.application(this.company, loan.applicationId), 'Original application') : of(undefined),
      plans: this.mode === 'repayment-plans' || this.mode === 'renegotiations' ? optional(this.api.plans(this.company, loan.id), 'Repayment plans') : of(undefined),
      installments: (this.mode === 'active' || this.mode === 'installments') ? optional(this.api.installments(this.company, loan.id), 'Installments') : of(undefined),
      disbursements: this.mode === 'disbursements' && this.can('disbursements.read') ? optional(this.api.disbursements(this.company, loan.id), 'Disbursements') : of(undefined),
      repayments: this.mode === 'repayments' && this.can('repayments.read') ? optional(this.api.repayments(this.company, loan.id), 'Repayments') : of(undefined),
      history: this.mode === 'active' ? optional(this.api.history(this.company, loan.id), 'Financial ledger') : of(undefined),
    }).pipe(map(related => ({ ...related, loan, relatedErrors: errors })));
  }
}
