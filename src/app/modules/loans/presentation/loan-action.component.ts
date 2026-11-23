import { Component, DestroyRef, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, NgForm } from '@angular/forms';
import { Observable, defer, switchMap } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { UUID, amount, cents, label, money, validDate } from '../domain/loans-format';
import { Decision, FREQUENCIES, Frequency, Renegotiation } from '../domain/loans.models';
import { LoansApi } from '../infrastructure/loans-api.service';

type AppAction = 'submit' | 'cancel' | 'approve' | 'reject';
type LoanAction = 'request-disbursement' | 'confirm-disbursement' | 'repayment' | 'reverse' |
  'request-deduction' | 'confirm-deduction' | 'renegotiate' | 'decide-renegotiation' | 'suspend' | 'resume' | 'settle';
export interface LoanActionRequest {
  action: AppAction | LoanAction;
  id?: string;
  itemId?: string;
  description?: string;
  reference?: string;
  maximum?: string;
}
export interface LoanActionResult { message: string; renegotiation?: Renegotiation }

const TITLES: Record<LoanActionRequest['action'], string> = {
  submit: 'Submit for approval', cancel: 'Cancel application', approve: 'Approve application', reject: 'Reject application',
  'request-disbursement': 'Request disbursement', 'confirm-disbursement': 'Confirm disbursement',
  repayment: 'Record confirmed repayment', reverse: 'Reverse repayment',
  'request-deduction': 'Request payroll deduction', 'confirm-deduction': 'Reconcile payroll deduction',
  renegotiate: 'Request renegotiation', 'decide-renegotiation': 'Record renegotiation decision',
  suspend: 'Suspend collection', resume: 'Resume collection', settle: 'Settle loan',
};

@Component({
  selector: 'app-loan-action',
  standalone: true,
  imports: [FormsModule, ComponentCardComponent],
  templateUrl: './loan-action.component.html',
})
export class LoanActionComponent implements OnInit {
  @Input({ required: true }) company!: number;
  @Input({ required: true }) request!: LoanActionRequest;
  @Output() readonly saved = new EventEmitter<LoanActionResult>();
  @Output() readonly cancelled = new EventEmitter<void>();
  private readonly api = inject(LoansApi);
  private readonly destroy = inject(DestroyRef);
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly confirmed = signal(false);
  private readonly instructionKey = crypto.randomUUID();
  protected readonly titles = TITLES;
  protected readonly frequencies = FREQUENCIES;
  protected readonly label = label;
  protected readonly money = money;
  protected reference = '';
  protected financialAmount = '';
  protected source = 'BANK_TRANSFER';
  protected reason = '';
  protected decision: Decision | '' = '';
  protected terms = { installmentCount: 1, firstDueDate: '', frequency: 'MONTHLY' as Frequency };

  ngOnInit() { this.reference = this.request.reference ?? ''; }

  protected run(form: NgForm) {
    if (form.invalid || this.busy() || !this.confirmed()) return;
    this.error.set('');
    try {
      const operation = this.operation();
      this.busy.set(true);
      operation.pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: value => {
          const action = this.request.action;
          this.busy.set(false);
          this.saved.emit({
            message: TITLES[action] + ' · completed.',
            renegotiation: action === 'renegotiate' || action === 'decide-renegotiation' ? value as Renegotiation : undefined,
          });
        },
        error: error => { this.busy.set(false); this.error.set(apiErrorMessage(error)); },
      });
    } catch (error) { this.error.set(apiErrorMessage(error)); }
  }

  private operation(): Observable<unknown> {
    const { action, itemId, maximum } = this.request;
    const id = this.request.id ?? '';
    const ref = this.reference.trim();
    const reason = this.reason.trim();
    const company = this.company;
    const requiredRef = () => {
      if (!ref) throw new Error('Enter the corresponding financial reference.');
      return ref;
    };
    const boundedAmount = () => {
      const value = amount(this.financialAmount);
      const limit = cents(maximum);
      if (limit !== null && cents(value)! > limit) throw new Error('Amount exceeds the displayed limit.');
      return value;
    };
    switch (action) {
      case 'submit':
      case 'cancel':
        return this.api.applicationAction(company, id, action);
      case 'approve':
      case 'reject':
        if (action === 'reject' && !reason) throw new Error('Enter a reason for rejection.');
        return this.api.decideApplication(company, id, action === 'approve' ? 'APPROVED' : 'REJECTED', reason || undefined);
      case 'request-disbursement':
        return this.api.requestDisbursement(company, id, 'web-disbursement:' + id + (itemId ? ':' + itemId : ''), ref || undefined);
      case 'confirm-disbursement':
        return this.api.confirmDisbursement(company, id, itemId!, requiredRef());
      case 'repayment': {
        const externalReference = requiredRef();
        const value = boundedAmount();
        return this.withReferenceKey(['repayment', id, this.source, externalReference],
          idempotencyKey => this.api.registerRepayment(company, id, { amount: value, source: this.source, externalReference, idempotencyKey }));
      }
      case 'reverse':
        return this.api.reverseRepayment(company, id, itemId!, requiredRef());
      case 'request-deduction':
        return this.api.requestDeduction(company, id, this.instructionKey);
      case 'confirm-deduction': {
        const payrollRunId = requiredRef();
        return this.api.confirmDeduction(company, id, { payrollRunId, confirmedAmount: boundedAmount(), idempotencyKey: 'web-confirm:' + id });
      }
      case 'renegotiate':
        if (!reason || !validDate(this.terms.firstDueDate) || !Number.isInteger(this.terms.installmentCount) ||
          this.terms.installmentCount < 1 || this.terms.installmentCount > 120) throw new Error('Enter the reason, first due date and a valid installment count.');
        return this.api.requestRenegotiation(company, id, { ...this.terms, reason });
      case 'decide-renegotiation':
        if (!UUID.test(ref) || !this.decision) throw new Error('Enter the renegotiation ID and select a decision.');
        return this.api.decideRenegotiation(company, ref, this.decision);
      case 'suspend':
      case 'resume':
        return this.api.status(company, id, action === 'suspend' ? 'SUSPEND' : 'RESUME');
      case 'settle':
        return this.api.settle(company, id);
    }
  }

  private withReferenceKey<T>(parts: string[], send: (key: string) => Observable<T>) {
    return defer(() => crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(parts)))).pipe(
      switchMap(digest => send('web-' + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join(''))),
    );
  }
}
