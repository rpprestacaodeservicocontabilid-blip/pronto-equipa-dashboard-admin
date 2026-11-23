import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { PageBreadcrumbComponent } from '../../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import {
  AuditEntry, Cadence, currentScope, Definition, Execution, ExecutionResult, Export, Format, Grouping, label, ReportCode, ReportPolicy, Schedule, Scope, Template,
} from '../domain/platform-reports.models';
import { ReportSection } from '../domain/platform-reports.navigation';
import { PlatformReportsApi } from '../infrastructure/platform-reports-api';
import { ReportCompanyPickerComponent } from './report-company-picker.component';
import { ReportResultTableComponent } from './report-result-table.component';

type RecordPage = 'executions' | 'exports' | 'templates' | 'schedules' | 'audit';

@Component({
  selector: 'app-report-management',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, RouterLink, ComponentCardComponent, PageBreadcrumbComponent, ReportCompanyPickerComponent, ReportResultTableComponent],
  templateUrl: './report-management.component.html',
  styleUrl: './platform-reports.css',
})
export class ReportManagementComponent {
  private readonly api = inject(PlatformReportsApi);
  private readonly route = inject(ActivatedRoute);
  protected readonly section = this.route.snapshot.data['section'] as ReportSection;
  protected readonly catalog = signal<Definition[]>([]);
  protected readonly page = signal(1);
  protected readonly total = signal(0);
  protected readonly busy = signal(false);
  protected readonly writing = signal(false);
  protected readonly error = signal('');
  protected readonly actionError = signal('');
  protected readonly catalogueError = signal('');
  protected readonly notice = signal('');
  protected readonly executions = signal<Execution[]>([]);
  protected readonly exports = signal<Export[]>([]);
  protected readonly templates = signal<Template[]>([]);
  protected readonly schedules = signal<Schedule[]>([]);
  protected readonly audit = signal<AuditEntry[]>([]);
  protected readonly policy = signal<ReportPolicy | null>(null);
  protected readonly selected = signal<ExecutionResult | null>(null);
  protected readonly selectionBusy = signal(false);
  protected readonly selectionError = signal('');
  protected readonly fromTemplate = signal<Template | null>(null);
  protected readonly editingSchedule = signal<Schedule | null>(null);
  protected readonly label = label;
  protected readonly limit = 25;
  protected readonly formats: Format[] = ['CSV', 'XLSX', 'PDF'];
  protected format: Format = 'CSV';
  protected readonly templateForm: { title: string; code: ReportCode; scope: Scope } = { title: '', code: 'REPORT_ACTIVITY', scope: currentScope() };
  protected readonly scheduleForm = { title: '', code: 'REPORT_ACTIVITY' as ReportCode, cadence: 'WEEKLY' as Cadence, grouping: 'day' as Grouping, companyId: undefined as number | undefined };
  protected readonly policyForm = { maxDays: 366, exportHours: 24, reason: '' };
  private request = 0;
  private selection = 0;

  constructor() {
    if (['executions', 'templates', 'schedules'].includes(this.section.view)) void this.loadCatalog();
    if (this.section.view === 'executions') {
      this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => void this.select(params.get('id')));
    }
    void this.load();
  }

  private async loadCatalog() {
    try { this.catalog.set(await firstValueFrom(this.api.catalog)); }
    catch (error) { this.catalogueError.set(apiErrorMessage(error)); }
  }

  protected async load(page = this.page()) {
    const request = ++this.request;
    this.busy.set(true);
    this.error.set('');
    try {
      if (this.section.view === 'policy') {
        const policy = await firstValueFrom(this.api.policy());
        if (request !== this.request) return;
        this.policy.set(policy);
        Object.assign(this.policyForm, { maxDays: policy.current.maxDays, exportHours: policy.current.exportHours, reason: '' });
        return;
      }
      const view = this.section.view as RecordPage;
      const list = await firstValueFrom(this.api.list(view, page));
      if (request !== this.request) return;
      switch (view) {
        case 'executions': this.executions.set(list.items as Execution[]); break;
        case 'exports': this.exports.set(list.items as Export[]); break;
        case 'templates': this.templates.set(list.items as Template[]); break;
        case 'schedules': this.schedules.set(list.items as Schedule[]); break;
        case 'audit': this.audit.set(list.items as AuditEntry[]); break;
      }
      this.page.set(list.page);
      this.total.set(list.total);
    } catch (error) {
      if (request === this.request) this.error.set(apiErrorMessage(error));
    } finally { if (request === this.request) this.busy.set(false); }
  }

  protected async select(id: string | null) {
    const request = ++this.selection;
    this.selectionError.set('');
    this.selected.set(null);
    this.selectionBusy.set(!!id);
    if (!id) return;
    try {
      const data = await firstValueFrom(this.api.execution(id));
      if (request === this.selection) this.selected.set(data);
    } catch (error) {
      if (request === this.selection) this.selectionError.set(apiErrorMessage(error));
    } finally { if (request === this.selection) this.selectionBusy.set(false); }
  }

  protected title(code: ReportCode) {
    return this.catalog().find(item => item.code === code)?.title ?? label(code);
  }

  protected companyFilter(code: ReportCode) {
    return this.catalog().some(item => item.code === code && item.companyFilter);
  }

  protected edit(item: Template | null) {
    this.fromTemplate.set(item);
    Object.assign(this.templateForm, { title: item?.title ?? '', code: item?.code ?? 'REPORT_ACTIVITY', scope: item ? { ...item.scope } : currentScope() });
  }

  protected saveTemplate() {
    const form = this.templateForm;
    if (!form.title.trim() || !form.scope.from || !form.scope.to) return;
    const scope = { ...form.scope, companyId: this.companyFilter(form.code) ? form.scope.companyId : undefined };
    void this.perform(async () => {
      const row = await firstValueFrom(this.api.saveTemplate({ title: form.title.trim(), code: form.code, scope, previousId: this.fromTemplate()?.id }));
      this.notice.set('Template version ' + row.version + ' published.');
      this.edit(null);
      await this.load(1);
    });
  }

  protected saveSchedule() {
    const form = this.scheduleForm;
    if (!form.title.trim()) return;
    void this.perform(async () => {
      const entry = this.editingSchedule();
      const input = { ...form, title: form.title.trim(), companyId: this.companyFilter(form.code) ? form.companyId : undefined };
      await firstValueFrom(entry ? this.api.editSchedule(entry.id, input) : this.api.schedule(input));
      this.editSchedule(null);
      this.notice.set(entry ? 'Schedule updated.' : 'Schedule created.');
      await this.load(1);
    });
  }

  protected editSchedule(item: Schedule | null) {
    this.editingSchedule.set(item);
    Object.assign(this.scheduleForm, { title: item?.title ?? '', code: item?.code ?? 'REPORT_ACTIVITY',
      cadence: item?.cadence ?? 'WEEKLY', grouping: item?.grouping ?? 'day', companyId: item?.companyId });
  }

  protected toggle(item: Schedule) {
    const status = item.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    void this.perform(async () => {
      const result = await firstValueFrom(this.api.setSchedule(item.id, status));
      this.notice.set('Schedule ' + result.status.toLowerCase() + '.');
      await this.load();
    });
  }

  protected retry(item: Execution) {
    void this.perform(async () => {
      const result = await firstValueFrom(this.api.retry(item.id));
      this.notice.set('Execution status · ' + label(result.status));
      await this.select(item.id);
      await this.load();
    });
  }

  protected prepareExport(item: Execution) {
    void this.perform(async () => {
      const file = await firstValueFrom(this.api.makeExport(item.id, this.format));
      this.notice.set('The export is ready.');
      await this.saveFile(file);
    });
  }

  protected download(item: Export) {
    void this.perform(() => this.saveFile(item));
  }

  protected publish() {
    const current = this.policy()?.current;
    const { maxDays, exportHours, reason } = this.policyForm;
    if (!current || reason.trim().length < 3) return;
    void this.perform(async () => {
      const version = await firstValueFrom(this.api.publish({ maxDays, exportHours }, current.version, reason.trim()));
      this.notice.set('Policy version ' + version.version + ' published.');
      await this.load();
    });
  }

  private async saveFile(item: Export) {
    const file = await firstValueFrom(this.api.download(item.id));
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = item.filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private async perform(operation: () => Promise<void>) {
    if (this.writing()) return;
    this.writing.set(true);
    this.actionError.set('');
    this.notice.set('');
    try { await operation(); }
    catch (error) { this.actionError.set(apiErrorMessage(error)); }
    finally { this.writing.set(false); }
  }
}
