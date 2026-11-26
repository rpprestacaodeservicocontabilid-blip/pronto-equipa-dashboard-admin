import { Component, DestroyRef, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { contractErrorMessage, isContractVersionConflict } from '../contract-errors';
import { CONTRACT_ACTIONS, ContractAction, ContractTerms, EmploymentContract } from '../../domain/contracts.models';
import { ContractsApi } from '../../infrastructure/contracts-api.service';
import { contractAmount, contractSalaryPattern, formatContractDate, normalizeContractSalary } from '../format-contract';

@Component({
  selector: 'app-contract-action',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './contract-action.component.html',
})
export class ContractActionComponent {
  @Input({ required: true }) companyId!: number;
  @Input({ required: true }) contract!: EmploymentContract;
  @Input({ required: true }) action!: ContractAction;
  @Output() completed = new EventEmitter<ContractAction>();
  @Output() dismissed = new EventEmitter<void>();
  @Output() stale = new EventEmitter<void>();

  private readonly api = inject(ContractsApi);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly details = CONTRACT_ACTIONS;
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly versionMismatch = signal(false);
  protected readonly now = new Date().toISOString().slice(0, 10);
  protected readonly date = formatContractDate;
  protected readonly amount = contractAmount;
  protected reason = '';
  protected reasonCode = '';
  protected newEndDate = '';
  protected suspensionStart = this.now;
  protected suspensionEnd = '';
  protected salary = '';
  protected readonly termFields = [
    { key: 'jobTitle', label: $localize`:@@contracts-job-title:Job title` }, { key: 'department', label: $localize`:@@ui-1430r53:Department` },
    { key: 'workplace', label: $localize`:@@contracts-workplace:Workplace` }, { key: 'schedule', label: $localize`:@@contracts-schedule:Schedule` },
    { key: 'workingHours', label: $localize`:@@contracts-working-hours:Working hours` }, { key: 'paymentTerms', label: $localize`:@@contracts-payment-terms:Payment terms` },
    { key: 'allowances', label: $localize`:@@contracts-allowances:Allowances` }, { key: 'notes', label: $localize`:@@contracts-other-conditions:Other conditions` },
  ] as const;
  protected term = this.termFields[0].key as (typeof this.termFields)[number]['key'];
  protected newValue = '';

  protected get reasonRequired() {
    return ['reject', 'renewals', 'amendments', 'suspensions', 'terminations'].includes(this.action);
  }

  protected confirm() {
    if (this.busy() || this.versionMismatch()) return;
    this.error.set('');
    let payload: Record<string, unknown>;
    try {
      payload = this.fields();
    } catch (error) {
      this.error.set(contractErrorMessage(error));
      return;
    }
    this.busy.set(true);
    this.api.act(this.companyId, this.contract, this.action, payload).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.busy.set(false); this.completed.emit(this.action); },
      error: error => {
        const message = contractErrorMessage(error);
        this.error.set(message);
        if (isContractVersionConflict(error)) {
          this.versionMismatch.set(true);
        }
        this.busy.set(false);
      },
    });
  }

  private fields(): Record<string, unknown> {
    const reason = this.reason.trim();
    if (this.reasonRequired && !reason) throw new Error($localize`:@@contracts-enter-a-reason-before-confirming:Enter a reason before confirming.`);
    switch (this.action) {
      case 'renewals':
        if (!this.contract.endDate || this.newEndDate <= this.contract.endDate || this.newEndDate < this.now) {
          throw new Error($localize`:@@contracts-the-new-end-date-must-extend-the-current-contract-term:The new end date must extend the current contract term.`);
        }
        return { newEndDate: this.newEndDate, reason };
      case 'amendments': {
        const changes: { salaryAmount?: string; terms?: ContractTerms } = {};
        if (this.salary) {
          if (!contractSalaryPattern.test(this.salary)) throw new Error($localize`:@@contracts-enter-a-non-negative-salary-with-up-to-two-decimal-places:Enter a non-negative salary with up to two decimal places.`);
          changes.salaryAmount = normalizeContractSalary(this.salary);
        }
        const newValue = this.newValue.trim();
        if (newValue) changes.terms = { ...this.contract.terms, [this.term]: newValue };
        if (!changes.salaryAmount && !changes.terms) throw new Error($localize`:@@contracts-enter-a-change-to-compensation-or-working-conditions:Enter a change to compensation or working conditions.`);
        return { effectiveDate: this.now, reason, changes };
      }
      case 'suspensions':
        if (!this.suspensionStart || this.suspensionStart < this.contract.startDate || this.suspensionStart > this.now
            || (this.suspensionEnd && this.suspensionEnd < this.suspensionStart)) {
          throw new Error($localize`:@@contracts-enter-a-valid-suspension-period-within-the-effective-contract:Enter a valid suspension period within the effective contract.`);
        }
        return { startDate: this.suspensionStart, endDate: this.suspensionEnd || null, reason };
      case 'terminations':
        if (!this.reasonCode.trim()) throw new Error($localize`:@@contracts-enter-a-termination-reason-code:Enter a termination reason code.`);
        return { effectiveDate: this.now, reasonCode: this.reasonCode.trim(), reason };
      default:
        return reason ? { reason } : {};
    }
  }
}
