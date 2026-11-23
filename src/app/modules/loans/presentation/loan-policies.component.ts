import { Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, NgForm } from '@angular/forms';
import { apiErrorMessage } from '../../../core/api/api-error';
import { CompanyWorkspace } from '../../../core/api/company-workspace-api';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { amount, label, money, today, validDate } from '../domain/loans-format';
import { LOAN_TYPES, LoanType, Policy, PolicyInput } from '../domain/loans.models';
import { hasGrant } from '../domain/loans-sections';
import { LoansApi } from '../infrastructure/loans-api.service';

const initialPolicy = (): PolicyInput => ({
  code: '', effectiveFrom: today(), maxAmount: '', maxInstallments: 1, maxActiveLoans: 1, allowedTypes: ['LOAN'],
  interestAllowed: false, maxAnnualInterestBps: 0, deductionAuthorizationRequired: true,
});

@Component({
  selector: 'app-loan-policies',
  standalone: true,
  imports: [FormsModule, ComponentCardComponent],
  templateUrl: './loan-policies.component.html',
})
export class LoanPoliciesComponent implements OnInit {
  @Input({ required: true }) context!: CompanyWorkspace;
  private readonly api = inject(LoansApi);
  private readonly destroy = inject(DestroyRef);
  protected readonly policies = signal<Policy[] | null>(null);
  protected readonly editing = signal(false);
  protected readonly confirmed = signal(false);
  protected readonly busy = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly writeError = signal('');
  protected readonly notice = signal('');
  protected readonly money = money;
  protected readonly label = label;
  protected readonly loanTypes = LOAN_TYPES;
  protected input = initialPolicy();
  protected get company() { return this.context.company.id; }
  protected can(grant: string) { return hasGrant(this.context.permissions, grant); }

  ngOnInit() { if (this.can('policies.read')) this.read(); }

  protected read() {
    this.loading.set(true);
    this.error.set('');
    this.api.policies(this.company).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: rows => { this.policies.set(rows); this.loading.set(false); },
      error: error => { this.error.set(apiErrorMessage(error)); this.loading.set(false); },
    });
  }

  protected edit(policy?: Policy) {
    this.input = policy ? {
      code: policy.code, effectiveFrom: today(), maxAmount: policy.maxAmount, maxInstallments: policy.maxInstallments,
      maxActiveLoans: policy.maxActiveLoans, allowedTypes: [...policy.allowedTypes], interestAllowed: policy.interestAllowed,
      maxAnnualInterestBps: policy.maxAnnualInterestBps, deductionAuthorizationRequired: policy.deductionAuthorizationRequired,
    } : initialPolicy();
    this.confirmed.set(false);
    this.notice.set('');
    this.writeError.set('');
    this.editing.set(true);
  }

  protected toggle(type: LoanType, enabled: boolean) {
    this.input.allowedTypes = enabled ? [...this.input.allowedTypes, type] : this.input.allowedTypes.filter(value => value !== type);
  }

  protected publish(form: NgForm) {
    if (!this.can('policies.manage') || form.invalid || this.busy() || !this.confirmed()) return;
    this.writeError.set('');
    const { code, effectiveFrom, maxInstallments, maxActiveLoans, interestAllowed, maxAnnualInterestBps, allowedTypes } = this.input;
    try {
      const bounded = (input: number, min: number, max: number) => Number.isInteger(input) && input >= min && input <= max;
      if (!code.trim() || !validDate(effectiveFrom) || !allowedTypes.length || !bounded(maxInstallments, 1, 120) ||
        !bounded(maxActiveLoans, 1, 100) || (interestAllowed && !bounded(maxAnnualInterestBps, 0, 100000))) {
        throw new Error('Check the policy code, effective date, loan types and limits.');
      }
      const input = { ...this.input, code: code.trim(), maxAmount: amount(this.input.maxAmount), maxAnnualInterestBps: interestAllowed ? maxAnnualInterestBps : 0 };
      this.busy.set(true);
      this.api.publishPolicy(this.company, input).pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: result => {
          this.busy.set(false);
          this.editing.set(false);
          this.notice.set('Policy ' + result.code + ' · version ' + result.version + ' published.');
          if (this.can('policies.read')) this.read();
        },
        error: error => { this.busy.set(false); this.writeError.set(apiErrorMessage(error)); },
      });
    } catch (error) { this.writeError.set(apiErrorMessage(error)); }
  }
}
