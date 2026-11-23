import { DatePipe } from '@angular/common';
import { Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../../core/api/api-error';
import { CompanyWorkspace } from '../../../core/api/company-workspace-api';
import { AuthSessionStore } from '../../auth/application/auth-session.store';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { UUID, label, money } from '../domain/loans-format';
import { Application, Simulation, Terms } from '../domain/loans.models';
import { hasGrant } from '../domain/loans-sections';
import { LoansApi } from '../infrastructure/loans-api.service';
import { LoanActionComponent, LoanActionRequest, LoanActionResult } from './loan-action.component';
import { LoanApplicationEditorComponent } from './loan-application-editor.component';
import { LoanEligibilityComponent } from './loan-eligibility.component';
import { LoanSimulationComponent } from './loan-simulation.component';

@Component({
  selector: 'app-loan-application',
  standalone: true,
  imports: [DatePipe, RouterLink, ComponentCardComponent, LoanActionComponent, LoanApplicationEditorComponent, LoanEligibilityComponent, LoanSimulationComponent],
  templateUrl: './loan-application.component.html',
})
export class LoanApplicationComponent implements OnInit {
  @Input({ required: true }) context!: CompanyWorkspace;
  @Input({ required: true }) id!: string;
  private readonly api = inject(LoansApi);
  private readonly auth = inject(AuthSessionStore);
  private readonly destroy = inject(DestroyRef);
  protected readonly record = signal<Application | null>(null);
  protected readonly editing = signal(false);
  protected readonly pending = signal<LoanActionRequest | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly preview = signal<Simulation | null>(null);
  protected readonly simulating = signal(false);
  protected readonly simulationError = signal('');
  protected readonly label = label;
  protected readonly money = money;
  protected get company() { return this.context.company.id; }
  protected can(grant: string) { return hasGrant(this.context.permissions, grant); }
  protected own(application: Application) { return this.auth.claims()?.sub === String(application.createdBy); }

  ngOnInit() { this.load(); }

  protected load() {
    this.record.set(null);
    this.preview.set(null);
    this.simulationError.set('');
    if (!this.can('applications.read')) { this.error.set('Your role does not include access to loan applications.'); return; }
    if (!UUID.test(this.id)) { this.error.set('Invalid loan application reference.'); return; }
    this.busy.set(true);
    this.error.set('');
    this.api.application(this.company, this.id).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: record => { this.busy.set(false); this.record.set(record); },
      error: error => { this.busy.set(false); this.error.set(apiErrorMessage(error)); },
    });
  }

  protected actions(record: Application): { action: 'approve' | 'reject' | 'submit' | 'cancel'; title: string }[] {
    const actions: ReturnType<LoanApplicationComponent['actions']> = [];
    if (record.status === 'DRAFT' && this.can('applications.submit')) actions.push({ action: 'submit', title: 'Submit for approval' });
    if ((record.status === 'DRAFT' || record.status === 'PENDING_APPROVAL') && this.own(record) && this.can('applications.cancel')) {
      actions.push({ action: 'cancel', title: 'Cancel application' });
    }
    if (record.status === 'PENDING_APPROVAL' && !this.own(record) && this.can('applications.decide')) {
      actions.push({ action: 'approve', title: 'Approve' }, { action: 'reject', title: 'Reject' });
    }
    return actions;
  }

  protected runSimulation(record: Application) {
    if (this.simulating()) return;
    const { annualInterestBps, currency, firstDueDate, frequency, installmentCount, loanType, requestedAmount } = record;
    const terms: Terms = { annualInterestBps, currency, firstDueDate, frequency, installmentCount, loanType, requestedAmount };
    this.simulating.set(true);
    this.simulationError.set('');
    this.api.simulate(this.company, terms).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: preview => { this.simulating.set(false); this.preview.set(preview); },
      error: error => { this.simulating.set(false); this.simulationError.set(apiErrorMessage(error)); },
    });
  }

  protected completed(result: LoanActionResult) {
    this.notice.set(result.message);
    this.pending.set(null);
    this.load();
  }
}
