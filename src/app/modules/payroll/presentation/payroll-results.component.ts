import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize, forkJoin, map, of } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { CompanyWorkspace } from '../../../core/api/company-workspace-api';
import { AuthService } from '../../../core/auth/auth.service';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { savedEngineEvidence } from '../../payroll-engine/domain/saved-engine-evidence';
import { EngineEvidenceComponent } from '../../payroll-engine/presentation/engine-evidence.component';
import { isPayrollId, payrollDate, payrollMoney } from '../domain/payroll-format';
import { ExportFormat, PayrollExport, PayrollRun, RUN_TITLES } from '../domain/payroll.models';
import { SENSITIVE_RESULTS } from '../domain/payroll-sections';
import { PayrollApi } from '../infrastructure/payroll-api.service';
import { payrollQuery, SubmissionKey } from './payroll-ui';

type DownloadRequest = PayrollExport & { format: ExportFormat; expiresAt: number };

@Component({
  selector: 'app-payroll-results', standalone: true,
  imports: [FormsModule, RouterLink, ComponentCardComponent, EngineEvidenceComponent], templateUrl: './payroll-results.component.html',
})
export class PayrollResultsComponent {
  readonly context = input.required<CompanyWorkspace>();
  readonly run = input.required<PayrollRun>();
  readonly revision = input.required<number>();
  private readonly api = inject(PayrollApi);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly exportKey = new SubmissionKey();
  private readonly retries = signal(0);
  protected readonly money = payrollMoney;
  protected readonly date = payrollDate;
  protected readonly titles = RUN_TITLES;
  protected readonly resultId = signal('');
  protected readonly search = signal('');
  protected readonly page = signal(1);
  protected readonly pageSize = 25;
  protected readonly comparisonOpen = signal(false);
  protected readonly comparisonTarget = signal('');
  protected readonly comparisonPage = signal(1);
  protected readonly exportFormat = signal<ExportFormat>('PDF');
  private readonly downloadKey = computed(() => {
    const account = this.auth.claims()?.sub;
    return account && this.canExport() ? ['prontoequipas.payroll-export', account, this.context().company.id, this.run().id].join('.') : '';
  });
  protected readonly exportJob = linkedSignal(() => this.restoreExport(this.downloadKey()));
  protected readonly exportBusy = signal(false);
  protected readonly exportError = signal('');
  protected readonly exportNotice = signal('');
  private readonly sensitive = computed(() => this.context().permissions.includes(SENSITIVE_RESULTS));
  protected readonly canCompare = computed(() => this.sensitive() && this.context().permissions.includes('payroll:results:compare'));
  protected readonly canExport = computed(() => this.sensitive() && this.context().permissions.includes('payroll:export'));
  protected readonly results = payrollQuery(computed(() => ({
    company: this.context().company.id, id: this.run().id, version: this.run().version,
    sensitive: this.sensitive(), revision: this.revision(), retries: this.retries(),
  })), ({ company, id, sensitive }) => sensitive ? this.api.runRead(company, id, 'results') : of([]));
  protected readonly filtered = computed(() => {
    const state = this.results();
    const filter = this.search().trim().toLowerCase();
    return state && 'data' in state ? state.data.filter(row => !filter || row.employeeId.toLowerCase().includes(filter)) : [];
  });
  protected readonly visible = computed(() => this.filtered().slice((this.page() - 1) * this.pageSize, this.page() * this.pageSize));
  protected readonly detail = payrollQuery(computed(() => ({
    company: this.context().company.id, run: this.run().id, id: this.resultId(), sensitive: this.sensitive(), retry: this.retries(),
  })), ({ company, run, id, sensitive }) => id && sensitive
    ? forkJoin({ result: this.api.result(company, run, id), explanation: this.api.explanation(company, run, id) }).pipe(
      map(({ result, explanation }) => savedEngineEvidence({ ...explanation, currency: result.currency }, result.employeeId)),
    ) : of(null));
  protected readonly alternatives = payrollQuery(computed(() => ({
    company: this.context().company.id, run: this.run().id, enabled: this.comparisonOpen() && this.canCompare(), retry: this.retries(),
  })), ({ company, run, enabled }) => enabled
    ? this.api.allRuns(company).pipe(map(rows => rows.filter(row => row.id !== run && row.status === 'CLOSED')))
    : of([]));
  protected readonly comparison = payrollQuery(computed(() => ({
    company: this.context().company.id, run: this.run().id, target: this.comparisonTarget(),
    enabled: this.comparisonOpen() && this.canCompare(), retry: this.retries(),
  })), ({ company, run, target, enabled }) => target && enabled ? this.api.compare(company, run, target) : of([]));

  protected refresh() { this.retries.update(value => value + 1); }
  protected changePage(delta: number) { this.page.update(value => value + delta); }
  protected changeComparisonPage(delta: number) { this.comparisonPage.update(value => value + delta); }

  protected requestExport() {
    if (!this.canExport() || this.exportBusy() || this.exportJob()) return;
    const runId = this.run().id;
    const format = this.exportFormat();
    const key = this.exportKey.for({ runId, format });
    this.exportBusy.set(true);
    this.exportError.set('');
    this.exportNotice.set('');
    this.api.export(this.context().company.id, runId, format, key).pipe(
      takeUntilDestroyed(this.destroyRef), finalize(() => this.exportBusy.set(false)),
    ).subscribe({
      next: job => this.setExport({ ...job, format, expiresAt: Date.now() + 24 * 60 * 60 * 1000 }),
      error: error => this.exportError.set(apiErrorMessage(error)),
    });
  }

  protected download() {
    const job = this.exportJob();
    if (!job || this.exportBusy() || !this.canExport()) return;
    this.exportBusy.set(true);
    this.exportError.set('');
    this.exportNotice.set('');
    this.api.download(this.context().company.id, job.id).pipe(takeUntilDestroyed(this.destroyRef),
      finalize(() => this.exportBusy.set(false))).subscribe({
      next: blob => {
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = 'payroll-' + this.run().id.slice(0, 8) + '.' + job.format.toLowerCase();
        link.click();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        this.setExport({ ...job, status: 'COMPLETED' });
        this.exportNotice.set('Payroll export downloaded.');
      },
      error: error => this.exportError.set(error instanceof HttpErrorResponse && error.status === 409
        ? 'This export is still pending or has expired. Try downloading again or request a new export.'
        : apiErrorMessage(error)),
    });
  }

  protected resetExport() {
    this.setExport(null);
    this.exportKey.clear();
    this.exportError.set('');
    this.exportNotice.set('');
  }

  private restoreExport(key: string): DownloadRequest | null {
    if (!key) return null;
    try {
      const request = JSON.parse(sessionStorage.getItem(key) ?? 'null') as Partial<DownloadRequest> | null;
      if (typeof request?.id === 'string' && isPayrollId(request.id) && typeof request.status === 'string' &&
          (request.format === 'PDF' || request.format === 'XLSX') &&
          typeof request.expiresAt === 'number' && request.expiresAt > Date.now()) return request as DownloadRequest;
      sessionStorage.removeItem(key);
      return null;
    } catch { return null; }
  }

  private setExport(request: DownloadRequest | null) {
    this.exportJob.set(request);
    const key = this.downloadKey();
    if (!key) return;
    try {
      if (request) sessionStorage.setItem(key, JSON.stringify(request));
      else sessionStorage.removeItem(key);
    } catch { /* The open results view can still download this export. */ }
  }
}
