import { Component, DestroyRef, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { CompanyWorkspace } from '../../../core/api/company-workspace-api';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { UUID, amount, label, money, validDate } from '../domain/loans-format';
import { Application, ApplicationInput, FREQUENCIES, LOAN_TYPES, LoanType, Policy, Simulation, Terms } from '../domain/loans.models';
import { hasGrant } from '../domain/loans-sections';
import { LoansApi } from '../infrastructure/loans-api.service';
import { LoanEligibilityComponent } from './loan-eligibility.component';
import { LoanEmployeePickerComponent } from './loan-employee-picker.component';
import { LoanSimulationComponent } from './loan-simulation.component';

@Component({
  selector: 'app-loan-application-editor',
  standalone: true,
  imports: [FormsModule, ComponentCardComponent, LoanEmployeePickerComponent, LoanEligibilityComponent, LoanSimulationComponent],
  templateUrl: './loan-application-editor.component.html',
})
export class LoanApplicationEditorComponent implements OnInit {
  @Input({ required: true }) context!: CompanyWorkspace;
  @Input() application?: Application;
  @Input() advance = false;
  @Output() readonly saved = new EventEmitter<Application>();
  @Output() readonly cancelled = new EventEmitter<void>();

  private readonly api = inject(LoansApi);
  private readonly destroy = inject(DestroyRef);
  protected readonly step = signal(1);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly simulation = signal<Simulation | null>(null);
  protected readonly policyRows = signal<Policy[] | null>(null);
  protected readonly label = label;
  protected readonly money = money;
  protected readonly frequencies = FREQUENCIES;
  protected readonly steps = ['Employee', 'Loan terms', 'Repayment preview', 'Review'];
  protected input: ApplicationInput = {
    employeeId: '', loanType: 'LOAN', requestedAmount: '', currency: 'AOA',
    installmentCount: 1, firstDueDate: '', frequency: 'MONTHLY', annualInterestBps: 0, reason: '',
  };

  protected get loanTypes() { return this.advance ? LOAN_TYPES.filter(type => type !== 'LOAN') : LOAN_TYPES; }
  protected get company() { return this.context.company.id; }
  protected get canSearch() { return this.context.permissions.includes('employees.read'); }
  protected get canSimulate() { return hasGrant(this.context.permissions, 'simulations.create'); }
  protected get employeeValid() { return UUID.test(this.input.employeeId); }
  protected get policy() {
    const day = new Date().toISOString().slice(0, 10);
    return this.policyRows()?.filter(policy => policy.active && policy.effectiveFrom <= day && (!policy.effectiveTo || policy.effectiveTo >= day) &&
      policy.allowedTypes.includes(this.input.loanType)).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom) || b.version - a.version)[0];
  }

  ngOnInit() {
    if (this.application) {
      const { employeeId, loanType, requestedAmount, installmentCount, firstDueDate, frequency, annualInterestBps, reason } = this.application;
      this.input = { employeeId, loanType, requestedAmount, installmentCount, firstDueDate, frequency, annualInterestBps, reason, currency: 'AOA' };
    } else if (this.advance) {
      this.input.loanType = 'SALARY_ADVANCE';
    }
    if (hasGrant(this.context.permissions, 'policies.read')) {
      this.api.policies(this.company).pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: policies => this.policyRows.set(policies), error: () => {},
      });
    }
  }

  protected chooseType(type: LoanType) {
    this.input.loanType = type;
    this.input.annualInterestBps = 0;
  }

  protected next() {
    if (this.busy()) return;
    this.error.set('');
    try {
      if (this.step() === 1 && !this.employeeValid) throw new Error('Select an employee or enter a valid employee ID.');
      if (this.step() === 2) { this.validate(); this.simulation.set(null); }
      this.step.update(done => Math.min(4, done + 1));
    } catch (error) { this.error.set(apiErrorMessage(error)); }
  }

  protected back() { this.error.set(''); this.step.update(done => Math.max(1, done - 1)); }

  protected preview() {
    this.perform(() => this.api.simulate(this.company, this.terms()), result => this.simulation.set(result));
  }

  protected save() {
    this.perform(() => {
      if (!this.employeeValid) throw new Error('Select a valid employee.');
      this.validate();
      return this.api.saveApplication(this.company, { ...this.terms(), employeeId: this.input.employeeId, reason: this.input.reason.trim() }, this.application?.id);
    }, record => this.saved.emit(record));
  }

  private terms(): Terms {
    const { loanType, installmentCount, firstDueDate, frequency, annualInterestBps, requestedAmount } = this.input;
    return { loanType, installmentCount, firstDueDate, frequency, annualInterestBps, requestedAmount: amount(requestedAmount), currency: 'AOA' };
  }

  private validate() {
    const terms = this.terms();
    if (!Number.isInteger(terms.installmentCount) || terms.installmentCount < 1 || terms.installmentCount > 120 ||
      !validDate(terms.firstDueDate)) throw new Error('Enter a first due date and from 1 to 120 installments.');
    if (!this.input.reason.trim()) throw new Error('Enter a reason for the application.');
    if (!Number.isInteger(terms.annualInterestBps) || terms.annualInterestBps < 0 || terms.annualInterestBps > 100000 ||
      (this.policy && (!this.policy.interestAllowed && terms.annualInterestBps !== 0 ||
        terms.annualInterestBps > this.policy.maxAnnualInterestBps))) throw new Error('Enter a rate within the applicable policy limit.');
  }

  private perform<T>(operation: () => Observable<T>, complete: (value: T) => void) {
    if (this.busy()) return;
    this.error.set('');
    try {
      const request = operation();
      this.busy.set(true);
      request.pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: value => { this.busy.set(false); complete(value); },
        error: error => { this.busy.set(false); this.error.set(apiErrorMessage(error)); },
      });
    } catch (error) { this.error.set(apiErrorMessage(error)); }
  }
}
