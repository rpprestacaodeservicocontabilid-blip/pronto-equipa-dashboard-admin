import { CurrencyPipe, DatePipe, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, PendingTasks, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable, firstValueFrom, forkJoin, skip, takeUntil } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { CompanyWorkspace } from '../../../core/api/company-workspace-api';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { PageBreadcrumbComponent } from '../../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { PayslipAccess } from '../company-payslips.routes';
import { BatchProgress, CompanyBatch, CompanyPayslipPolicy, CompanyReceipt, CompanyTemplate,
  CompanyTemplateVersion, Correction, Issuance, ReceiptEvent, ReceiptPage, Summary, Verification, uuid } from '../domain/company-payslips.models';
import { CompanyPayslipSection, companyPayslipSections, hasPayslipGrants } from '../domain/company-payslips.navigation';
import { RECEIPT_STATUSES, RECEIPT_TYPES, ReceiptStatus, ReceiptType, label } from '../domain/payslip-supervision.models';
import { CompanyPayslipsApi } from '../infrastructure/company-payslips-api';
import { PayslipIssuanceComponent } from './payslip-issuance.component';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, CurrencyPipe, DatePipe, DecimalPipe, NgTemplateOutlet, ComponentCardComponent,
    PageBreadcrumbComponent, PayslipIssuanceComponent],
  templateUrl: './company-payslips.component.html',
  styleUrl: './payslip-supervision.css',
})
export class CompanyPayslipsComponent {
  private readonly api = inject(CompanyPayslipsApi);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy = inject(DestroyRef);
  private readonly pending = inject(PendingTasks);
  private generation = 0;
  private issueKey?: { result: string; version: string; key: string };
  protected readonly label = label;
  protected readonly types = RECEIPT_TYPES;
  protected readonly statuses = RECEIPT_STATUSES;
  protected readonly company = signal<CompanyWorkspace | null>(null);
  protected readonly section = signal<CompanyPayslipSection | undefined>(undefined);
  protected readonly denied = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly directory = signal<ReceiptPage | null>(null);
  protected readonly receipt = signal<CompanyReceipt | null>(null);
  protected readonly events = signal<ReceiptEvent[] | null>(null);
  protected readonly corrections = signal<Correction[] | null>(null);
  protected readonly verification = signal<Verification | null>(null);
  protected readonly correcting = signal(false);
  protected readonly creatingBatch = signal(false);
  protected readonly batches = signal<CompanyBatch[]>([]);
  protected readonly batch = signal<CompanyBatch | null>(null);
  protected readonly progress = signal<BatchProgress | null>(null);
  protected readonly templates = signal<CompanyTemplate[]>([]);
  protected readonly template = signal<CompanyTemplate | null>(null);
  protected readonly preview = signal<CompanyTemplateVersion | null>(null);
  protected readonly summary = signal<Summary | null>(null);
  protected readonly policy = signal<CompanyPayslipPolicy | null>(null);
  protected employee = '';
  protected userId: number | null = null;
  protected filterType: ReceiptType | '' = '';
  protected filterStatus: ReceiptStatus | '' = '';
  protected templateCode = '';
  protected templateName = '';
  protected version = '';
  protected title = 'RECIBO DE VENCIMENTO';
  protected allowDownload = true;
  protected reportFormat = 'CSV';
  protected reportType = 'summary';

  constructor() {
    this.route.data.pipe(takeUntilDestroyed(this.destroy)).subscribe(data => {
      this.generation++;
      this.reset();
      const access = data['access'] as PayslipAccess;
      if ('error' in access) { this.denied.set(access.error); return; }
      this.company.set(access.context);
      const section = (data['section'] as CompanyPayslipSection | undefined)
        ?? companyPayslipSections.find(option => this.allowed(...option.grants));
      if (!section || !this.allowed(...section.grants)) {
        this.denied.set('Your company permissions do not include this payslip workspace.');
        return;
      }
      this.section.set(section);
      this.refresh();
    });
  }

  protected allowed(...grants: string[]) { return hasPayslipGrants(this.company()?.permissions ?? [], ...grants); }
  protected own() { return this.section()?.view === 'portal'; }
  protected ready(row: CompanyReceipt) { return ['VALIDATED', 'PUBLISHED', 'SUPERSEDED', 'ARCHIVED'].includes(row.status); }
  protected correctable(row: CompanyReceipt) {
    return ['VALIDATED', 'PUBLISHED'].includes(row.status) && row.type !== 'DUPLICATE_COPY';
  }

  protected refresh() {
    if (this.section()?.view === 'directory' || this.own()) {
      this.list(1);
      return;
    }
    if (['issue', 'link'].includes(this.section()?.view ?? '')) return;
    void this.perform(async id => {
      switch (this.section()?.view) {
        case 'batches': this.batches.set(await this.request(this.api.batches(id))); break;
        case 'templates': this.templates.set(await this.request(this.api.templates(id))); break;
        case 'summary': this.summary.set(await this.request(this.api.summary(id))); break;
        case 'policy': this.showPolicy(await this.request(this.api.policy(id))); break;
      }
    });
  }

  protected list(page: number) {
    const section = this.section();
    const worker = this.employee.trim();
    if (!this.own() && worker && !uuid.test(worker)) { this.error.set('Enter a valid worker ID.'); return; }
    void this.perform(async id => {
      this.clearReceipt();
      this.directory.set(await this.request(this.api.list(id, this.own() ? { page, limit: 25 } : {
        page, limit: 25, employeeId: worker || undefined,
        type: section?.type || this.filterType || undefined, status: section?.status || this.filterStatus || undefined,
      }, this.own())));
    });
  }

  protected openReceipt(id: string) {
    void this.perform(async company => {
      this.clearReceipt();
      this.receipt.set(await this.request(this.api.receipt(company, id, this.own())));
    });
  }

  protected receiptAction(row: CompanyReceipt, action: 'publish' | 'copy' | 'history' | 'corrections' | 'verify') {
    void this.perform(async id => {
      switch (action) {
        case 'publish':
          this.receipt.set(await this.request(this.api.publish(id, row.id)));
          this.directory.update(page => page ? { ...page, data: page.data.map(item => item.id === row.id ? { ...item, status: 'PUBLISHED' } : item) } : null);
          this.notice.set('Payslip published to the employee portal.');
          break;
        case 'copy':
          this.clearReceipt();
          this.receipt.set(await this.request(this.api.copy(id, row.id)));
          this.notice.set('Duplicate copy issued.');
          break;
        case 'history': this.events.set((await this.request(this.api.history(id, row.id))).events); break;
        case 'corrections': this.corrections.set(await this.request(this.api.corrections(id, row.id))); break;
        case 'verify': this.verification.set(await this.request(this.api.verify(id, row.id))); break;
      }
    });
  }

  protected file(row: CompanyReceipt, action: 'download' | 'print') {
    if (this.busy()) return;
    const tab = action === 'print' ? window.open('about:blank', '_blank') : null;
    if (action === 'print' && !tab) { this.error.set('Allow pop-ups to open the printable PDF.'); return; }
    if (tab) tab.opener = null;
    void this.perform(async id => {
      try {
        const blob = await this.request(this.api.pdf(id, row.id, action, this.own()));
        if (tab) {
          const url = URL.createObjectURL(blob);
          tab.location.replace(url);
          setTimeout(() => URL.revokeObjectURL(url), 60000);
        } else this.download(blob, row.number + '.pdf');
      } catch (error) { tab?.close(); throw error; }
    });
  }

  protected issue(input: Issuance) {
    void this.perform(async id => {
      const result = input.results[0].id;
      if (this.issueKey?.result !== result || this.issueKey.version !== input.templateVersionId) {
        this.issueKey = { result, version: input.templateVersionId, key: crypto.randomUUID() };
      }
      this.clearReceipt();
      this.receipt.set(await this.request(this.api.issue(id, input, this.issueKey.key)));
      this.notice.set('Payroll document recorded.');
    });
  }

  protected correct(original: CompanyReceipt, input: Issuance) {
    void this.perform(async id => {
      const correction = await this.request(this.api.correct(id, original.id, input));
      this.correcting.set(false);
      this.clearReceipt();
      this.receipt.set(await this.request(this.api.receipt(id, correction.correctionPayslipId)));
      this.notice.set('Correction issued and linked to the original receipt.');
    });
  }

  protected createBatch(input: Issuance) {
    void this.perform(async id => {
      const batch = await this.request(this.api.createBatch(id, input));
      this.creatingBatch.set(false);
      this.notice.set('Batch created. Start generation from its details.');
      await this.loadBatch(id, batch.id);
      this.batches.set(await this.request(this.api.batches(id)));
    });
  }

  protected openBatch(id: string) { void this.perform(company => this.loadBatch(company, id)); }

  protected batchAction(row: CompanyBatch, action: 'generate' | 'retry-failed' | 'publish') {
    void this.perform(async id => {
      const output = await this.request(this.api.batchAction(id, row.id, action));
      this.notice.set(action === 'publish' ? (output.published ?? 0) + ' payslips published.' : 'Batch generation requested.');
      await this.loadBatch(id, row.id);
      this.batches.set(await this.request(this.api.batches(id)));
    });
  }

  protected createTemplate() {
    if (!this.templateCode.trim() || !this.templateName.trim()) return;
    void this.perform(async id => {
      this.template.set(await this.request(this.api.createTemplate(id, { code: this.templateCode.trim(), name: this.templateName.trim() })));
      this.templateCode = this.templateName = '';
      this.preview.set(null);
      this.templates.set(await this.request(this.api.templates(id)));
    });
  }

  protected openTemplate(row: CompanyTemplate) {
    void this.perform(async id => {
      this.preview.set(null);
      this.template.set(await this.request(this.api.template(id, row.id)));
    });
  }

  protected createVersion(row: CompanyTemplate) {
    if (!this.version.trim() || !this.title.trim()) return;
    void this.perform(async id => {
      await this.request(this.api.createVersion(id, row.id, this.version.trim(), this.title.trim()));
      this.version = '';
      this.template.set(await this.request(this.api.template(id, row.id)));
      this.notice.set('Draft template version saved.');
    });
  }

  protected templateAction(row: CompanyTemplate, version: CompanyTemplateVersion, action: 'preview' | 'publish') {
    void this.perform(async id => {
      if (action === 'preview') { this.preview.set(await this.request(this.api.previewVersion(id, row.id, version.version))); return; }
      await this.request(this.api.publishVersion(id, version.id));
      this.template.set(await this.request(this.api.template(id, row.id)));
      this.preview.set(null);
      this.notice.set('Template version published and available for issuance.');
    });
  }

  protected updatePolicy() {
    const current = this.policy();
    if (!current) return;
    void this.perform(async id => {
      this.showPolicy(await this.request(this.api.updatePolicy(id, {
        allowWorkerDownload: this.allowDownload, retentionDays: current.retentionDays,
        notifyWorkerOnPublish: current.notifyWorkerOnPublish, requireManualPublication: current.requireManualPublication,
      })));
      this.notice.set('Employee download policy updated.');
    });
  }

  protected linkWorker() {
    const actor = this.userId;
    if (!uuid.test(this.employee.trim()) || actor == null || !Number.isSafeInteger(actor) || actor < 1) {
      this.error.set('Enter a valid worker ID and user ID.');
      return;
    }
    void this.perform(async id => {
      await this.request(this.api.link(id, this.employee.trim(), actor));
      this.notice.set('Employee portal access linked.');
    });
  }

  protected exportReport() {
    void this.perform(async id => {
      const blob = await this.request(this.api.export(id, this.reportFormat, this.reportType));
      this.download(blob, 'payslips-' + this.reportType + '.' + this.reportFormat.toLowerCase());
    });
  }

  private async loadBatch(company: number, id: string) {
    const value = await this.request(forkJoin({ batch: this.api.batch(company, id), progress: this.api.progress(company, id) }));
    this.batch.set(value.batch);
    this.progress.set(value.progress);
  }

  private showPolicy(value: CompanyPayslipPolicy) {
    this.policy.set(value);
    this.allowDownload = value.allowWorkerDownload;
  }

  private clearReceipt() {
    this.receipt.set(null);
    this.events.set(null);
    this.corrections.set(null);
    this.verification.set(null);
    this.correcting.set(false);
  }

  private reset() {
    this.company.set(null); this.section.set(undefined); this.denied.set(''); this.error.set(''); this.notice.set('');
    this.busy.set(false); this.directory.set(null); this.clearReceipt(); this.batches.set([]); this.batch.set(null);
    this.progress.set(null); this.creatingBatch.set(false); this.templates.set([]); this.template.set(null); this.preview.set(null);
    this.summary.set(null); this.policy.set(null); this.employee = ''; this.userId = null; this.filterStatus = '';
    this.filterType = ''; this.issueKey = undefined; this.templateCode = ''; this.templateName = ''; this.version = '';
    this.title = 'RECIBO DE VENCIMENTO'; this.reportFormat = 'CSV'; this.reportType = 'summary';
  }

  private download(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private async request<T>(stream: Observable<T>) {
    const generation = this.generation;
    const output = await firstValueFrom(stream.pipe(takeUntil(this.route.data.pipe(skip(1))), takeUntilDestroyed(this.destroy)));
    if (generation !== this.generation || this.destroy.destroyed) throw new Error('Company changed.');
    return output;
  }

  private async perform(task: (company: number) => Promise<void>) {
    const id = this.company()?.company.id;
    if (!id || this.busy() || this.denied()) return;
    const generation = this.generation;
    const done = this.pending.add();
    this.busy.set(true); this.error.set(''); this.notice.set('');
    try { await task(id); }
    catch (error) { if (!this.destroy.destroyed && generation === this.generation) this.error.set(apiErrorMessage(error)); }
    finally { if (!this.destroy.destroyed && generation === this.generation) this.busy.set(false); done(); }
  }
}
