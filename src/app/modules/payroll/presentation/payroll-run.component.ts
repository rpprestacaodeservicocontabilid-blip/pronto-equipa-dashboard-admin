import { Component, DestroyRef, NgZone, computed, effect, inject, input, linkedSignal, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EMPTY, Subject, catchError, defer, finalize, interval, of, switchMap } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { CompanyWorkspace } from '../../../core/api/company-workspace-api';
import { AuthService } from '../../../core/auth/auth.service';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { availablePayrollActions, PayrollAction } from '../domain/payroll-actions';
import { payrollDate, payrollLabel } from '../domain/payroll-format';
import { PayrollProgress, RUN_TITLES, RunAction } from '../domain/payroll.models';
import { canCreatePayrollRun, HISTORY_READ, PAYMENTS_PREPARE, PAYMENTS_READ, PayrollSection, PayrollTab, SENSITIVE_RESULTS } from '../domain/payroll-sections';
import { PayrollApi } from '../infrastructure/payroll-api.service';
import { PayrollEvidenceComponent } from './payroll-evidence.component';
import { payrollQuery } from './payroll-ui';

const TABS: { id: PayrollTab; title: string; grants?: string[] }[] = [
  { id: 'summary', title: 'Totals' },
  { id: 'issues', title: 'Issues' },
  { id: 'results', title: 'Employee results', grants: [SENSITIVE_RESULTS] },
  { id: 'approvals', title: $localize`:@@ui-1m405m7:Approvals` },
  { id: 'closing', title: 'Closing' },
  { id: 'payments', title: $localize`:@@ui-jbt9om:Payments`, grants: [PAYMENTS_PREPARE, PAYMENTS_READ] },
  { id: 'history', title: $localize`:@@ui-yugfpb:History`, grants: [HISTORY_READ] },
];

const MESSAGES: Partial<Record<RunAction, string>> = {
  validate: 'Pre-validation queued.',
  process: 'Payroll calculations queued.',
  'retry-failed': 'Failed calculations queued for retry.',
  submit: 'Run submitted for approval.',
  approve: 'Approval recorded.',
  reject: 'Run rejected.',
  close: 'Payroll run closed.',
  cancel: 'Run cancelled.',
  'payment-instructions': 'Payment instructions prepared.',
};

@Component({
  selector: 'app-payroll-run', standalone: true,
  imports: [FormsModule, RouterLink, ComponentCardComponent, PayrollEvidenceComponent], templateUrl: './payroll-run.component.html',
})
export class PayrollRunComponent {
  readonly context = input.required<CompanyWorkspace>();
  readonly section = input.required<PayrollSection>();
  readonly runId = input.required<string>();
  private readonly api = inject(PayrollApi);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly zone = inject(NgZone);
  private readonly refreshCount = signal(0);
  private readonly progressReads = new Subject<boolean>();
  private readonly validationVersion = signal<number | null>(null);
  private confirmationVersion: number | null = null;
  protected readonly progress = signal<PayrollProgress | null>(null);
  protected readonly progressError = signal('');
  protected readonly syncing = signal(false);
  protected readonly busy = signal(false);
  protected readonly failure = signal('');
  protected readonly notice = signal('');
  protected readonly confirmation = signal<PayrollAction | null>(null);
  protected readonly evidenceRevision = signal(0);
  protected readonly date = payrollDate;
  protected readonly label = payrollLabel;
  protected readonly titles = RUN_TITLES;
  protected reason = '';

  protected readonly state = payrollQuery(computed(() => ({
    company: this.context().company.id, id: this.runId(), refresh: this.refreshCount(),
  })), ({ company, id }) => this.api.run(company, id));
  private readonly record = computed(() => {
    const data = this.state();
    return data && 'data' in data ? data.data : null;
  });
  protected readonly run = computed(() => {
    const row = this.record();
    const progress = this.progress();
    return row && progress && progress.version >= row.version
      ? { ...row, status: progress.status, version: progress.version } : row;
  }, { equal: (previous, current) => previous === current || (
    !!previous && !!current && previous.id === current.id && previous.version === current.version && previous.status === current.status
  ) });
  protected readonly period = payrollQuery(computed(() => ({ company: this.context().company.id, id: this.record()?.periodId })),
    ({ company, id }) => id ? this.api.period(company, id) : of(null));
  protected readonly waitingForValidation = computed(() => {
    const run = this.run();
    const command = this.validationVersion();
    return command !== null && run?.status === 'VALIDATING' && run.version <= command;
  });
  protected readonly actions = computed(() => {
    const run = this.run();
    return run ? availablePayrollActions(run, this.context().permissions, this.auth.claims()?.sub, this.waitingForValidation()) : [];
  });
  protected readonly ownSubmission = computed(() => {
    const run = this.run();
    return run?.status === 'SUBMITTED' && this.auth.claims()?.sub === String(run.createdBy) &&
      this.context().permissions.includes('payroll:approvals:approve');
  });
  protected readonly tabs = computed(() => TABS.filter(tab => !tab.grants || tab.grants.some(grant => this.context().permissions.includes(grant))));
  protected readonly tab = linkedSignal<PayrollTab>(() => {
    const preferred = this.section().tab ?? 'summary';
    return this.tabs().some(tab => tab.id === preferred) ? preferred : 'summary';
  });

  constructor() {
    this.progressReads.pipe(switchMap(showLoading => {
      if (!this.record()) return EMPTY;
      return defer(() => {
        if (showLoading) this.syncing.set(true);
        return this.api.runRead(this.context().company.id, this.runId(), 'progress').pipe(
          catchError(error => {
            this.progressError.set(apiErrorMessage(error));
            return EMPTY;
          }),
          finalize(() => this.syncing.set(false)),
        );
      });
    }), takeUntilDestroyed()).subscribe(progress => {
      this.progressError.set('');
      const previous = this.progress();
      if (!previous || progress.version >= previous.version) this.progress.set(progress);
    });
    effect(() => {
      if (this.record()) untracked(() => this.progressReads.next(true));
    });
    this.zone.runOutsideAngular(() => interval(6000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      const status = this.run()?.status;
      if ((status === 'PROCESSING' || (status === 'VALIDATING' &&
        (this.validationVersion() === null || this.waitingForValidation()))) && !this.busy() && !this.syncing()) {
        this.zone.run(() => this.progressReads.next(false));
      }
    }));
  }

  protected refreshRun() { this.refreshCount.update(value => value + 1); }
  protected refreshProgress() {
    this.progressReads.next(true);
    this.evidenceRevision.update(value => value + 1);
  }
  protected canAdjust(type: 'CORRECTION' | 'SUPPLEMENTARY' | 'RETROACTIVE') {
    return canCreatePayrollRun(type, this.context().permissions);
  }
  protected begin(action: PayrollAction) {
    this.failure.set('');
    this.notice.set('');
    this.reason = '';
    if (action.confirmation) {
      this.confirmationVersion = this.run()?.version ?? null;
      this.confirmation.set(action);
    } else this.execute(action);
  }
  protected execute(action: PayrollAction) {
    const run = this.run();
    if (!run || this.busy() || this.syncing() || this.progressError()) return;
    if (action.confirmation && this.confirmation()?.id !== action.id) return;
    if (action.confirmation && run.version !== this.confirmationVersion) {
      this.confirmation.set(null);
      this.failure.set('The run has changed. Review the latest version before confirming.');
      return;
    }
    if (!this.actions().includes(action)) return;
    const reason = action.id === 'reject' ? this.reason.trim() : undefined;
    if (action.id === 'reject' && !reason) return;
    this.busy.set(true);
    this.failure.set('');
    this.api.runAction(this.context().company.id, run, action.id, reason).pipe(
      takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false)),
    ).subscribe({
      next: () => {
        if (action.id === 'validate') this.validationVersion.set(run.version + 1);
        this.notice.set(MESSAGES[action.id] ?? 'Payroll run updated.');
        this.confirmation.set(null);
        if (action.id === 'payment-instructions') this.tab.set('payments');
        this.refreshProgress();
      },
      error: error => {
        this.confirmation.set(null);
        this.failure.set(apiErrorMessage(error));
        this.refreshProgress();
      },
    });
  }
}
