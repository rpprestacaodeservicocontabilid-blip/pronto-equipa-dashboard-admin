import { CurrencyPipe, DatePipe, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, PendingTasks, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable, firstValueFrom, forkJoin, map, of, skip, takeUntil } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { CompanyWorkspace } from '../../../core/api/company-workspace-api';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { PageBreadcrumbComponent } from '../../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { ReportWorkspaceAccess } from '../company-reports.routes';
import { CompanyIndicators, CompanyReport, CompanyReportResult, CustomPreview, CustomReport,
  FilterKey, ReportConfiguration, ReportFile, ReportFilters, RunSummary, domainLabels, fieldLabel } from '../domain/company-reports.models';
import { CompanyReportSection, companyReportSections, hasReportGrants } from '../domain/company-reports.navigation';
import { Format, currentScope } from '../domain/platform-reports.models';
import { CompanyReportsApi } from '../infrastructure/company-reports-api';
import { CompanyReportTableComponent } from './company-report-table.component';

type FilterDraft = { from: string; to: string; employeeId: string; departmentId: number | null; status: string; limit: number };
const freshFilters = (): FilterDraft => ({ from: '', to: '', employeeId: '', departmentId: null, status: '', limit: 1000 });
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const day = 86400000;

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe, CurrencyPipe, DecimalPipe, NgTemplateOutlet, ComponentCardComponent,
    PageBreadcrumbComponent, CompanyReportTableComponent],
  styleUrl: './platform-reports.css',
  templateUrl: './company-reports.component.html',
})
export class CompanyReportsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(CompanyReportsApi);
  private readonly destroy = inject(DestroyRef);
  private readonly pending = inject(PendingTasks);
  private revision = 0;
  protected readonly domainLabels = domainLabels;
  protected readonly fieldLabel = fieldLabel;
  protected readonly company = signal<CompanyWorkspace | null>(null);
  protected readonly section = signal<CompanyReportSection | undefined>(undefined);
  protected readonly forbidden = signal('');
  protected readonly error = signal('');
  protected readonly message = signal('');
  protected readonly busy = signal(false);
  protected readonly catalogue = signal<CompanyReport[]>([]);
  protected readonly search = signal('');
  protected readonly matches = computed(() => {
    const domain = this.section()?.domain;
    const search = this.search().trim().toLowerCase();
    return this.catalogue().filter(row => (!domain || row.domain === domain)
      && [row.code, row.name, row.source].some(value => value.toLowerCase().includes(search)));
  });
  protected readonly selected = signal<ReportConfiguration | null>(null);
  protected readonly result = signal<CompanyReportResult | null>(null);
  protected readonly history = signal<RunSummary[]>([]);
  protected readonly files = signal<ReportFile[]>([]);
  protected readonly createdFile = signal<ReportFile | null>(null);
  protected readonly templates = signal<CustomReport[]>([]);
  protected readonly preview = signal<CustomPreview | null>(null);
  protected readonly dashboard = signal<CompanyIndicators | null>(null);
  protected readonly previous = signal<{ data: CompanyIndicators; from: string; to: string } | null>(null);
  protected readonly activePeriod = signal<{ from?: string; to?: string } | null>(null);
  protected filters = freshFilters();
  protected compare = false;
  protected name = '';
  protected fields: string[] = [];
  protected format: Format = 'CSV';

  constructor() {
    this.route.data.pipe(takeUntilDestroyed(this.destroy)).subscribe(data => {
      this.revision++;
      this.reset();
      const access = data['access'] as ReportWorkspaceAccess;
      if ('error' in access) {
        this.forbidden.set(access.error);
        return;
      }
      this.company.set(access.context);
      const section = (data['section'] as CompanyReportSection | undefined)
        ?? companyReportSections.find(option => this.allowed(...option.grants));
      if (!section || !this.allowed(...section.grants)) {
        this.forbidden.set('Your company permissions do not include this report workspace.');
        return;
      }
      this.section.set(section);
      if (section.view === 'dashboard') {
        const { from, to } = currentScope();
        this.filters = { ...this.filters, from, to };
        this.loadDashboard();
      } else {
        this.refresh();
      }
    });
  }

  protected allowed(...grants: string[]) {
    return hasReportGrants(this.company()?.permissions ?? [], ...grants);
  }

  protected refresh() {
    void this.perform(async id => {
      switch (this.section()?.view) {
        case 'catalog':
          this.catalogue.set((await this.request(this.api.catalogue(id))).filter(row => row.workspaceFilters));
          break;
        case 'custom': {
          const data = await this.request(forkJoin({ catalogue: this.api.catalogue(id), templates: this.api.templates(id) }));
          this.catalogue.set(data.catalogue.filter(row => row.workspaceFilters));
          this.templates.set(data.templates);
          break;
        }
        case 'history':
          this.history.set(await this.request(this.api.history(id)));
          break;
        case 'exports':
          this.files.set(await this.request(this.api.exports(id)));
          break;
      }
    });
  }

  protected loadDashboard() {
    const filters = this.validatedFilters(['from', 'to', 'departmentId'], false);
    if (!filters) return;
    let previousRange: { from: string; to: string } | undefined;
    if (this.compare) {
      if (!filters.from || !filters.to) {
        this.error.set('Enter both dates to compare periods.');
        return;
      }
      const start = Date.parse(filters.from);
      const end = Date.parse(filters.to);
      const iso = (date: number) => new Date(date).toISOString().slice(0, 10);
      previousRange = { from: iso(start - (end - start + day)), to: iso(start - day) };
    }
    const range = previousRange;
    void this.perform(async id => {
      const response = await this.request(forkJoin({
        current: this.api.dashboard(id, filters),
        previous: range ? this.api.dashboard(id, { ...filters, ...range }).pipe(map(data => ({ ...range, data }))) : of(null),
      }));
      this.dashboard.set(response.current);
      this.previous.set(response.previous);
      this.activePeriod.set({ from: filters.from, to: filters.to });
    });
  }

  protected select(code: string) {
    if (!code) {
      this.selected.set(null);
      this.fields = [];
      return;
    }
    void this.perform(async id => {
      const definition = await this.request(this.api.definition(id, code));
      this.selected.set(definition);
      this.fields = [];
      this.result.set(null);
      this.preview.set(null);
      this.createdFile.set(null);
    });
  }

  protected run(report: ReportConfiguration) {
    const filters = this.validatedFilters(report.workspaceFilters ?? []);
    if (!filters) return;
    void this.perform(async id => {
      this.createdFile.set(null);
      this.result.set(await this.request(this.api.run(id, report.code, filters)));
      this.message.set('Report generated and saved in execution history.');
    });
  }

  protected loadResult(row: RunSummary) {
    void this.perform(async id => {
      this.result.set(null);
      this.createdFile.set(null);
      this.result.set(await this.request(this.api.result(id, row.id)));
    });
  }

  protected exportResult(row: CompanyReportResult) {
    void this.perform(async id => {
      this.createdFile.set(await this.request(this.api.exportExecution(id, row.id, this.format)));
      this.message.set('File generated from the saved result.');
    });
  }

  protected download(row: ReportFile) {
    void this.perform(async id => {
      const blob = await this.request(this.api.download(id, row.id));
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = row.filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  protected toggleField(field: string, checked: boolean) {
    this.fields = checked ? [...this.fields, field] : this.fields.filter(item => item !== field);
  }

  protected saveTemplate(report: ReportConfiguration) {
    const name = this.name.trim();
    const filters = this.validatedFilters(report.workspaceFilters ?? []);
    if (!filters || name.length < 2 || !this.fields.length) return;
    void this.perform(async id => {
      await this.request(this.api.createTemplate(id, { name, code: report.code, filters, fields: this.fields }));
      this.name = '';
      this.fields = [];
      this.message.set('Custom report saved.');
      this.templates.set(await this.request(this.api.templates(id)));
    });
  }

  protected previewTemplate(row: CustomReport) {
    void this.perform(async id => {
      this.preview.set(null);
      this.preview.set(await this.request(this.api.previewTemplate(id, row.id)));
    });
  }

  protected publish(row: CustomReport) {
    void this.perform(async id => {
      const published = await this.request(this.api.publishTemplate(id, row.id));
      this.templates.update(rows => rows.map(item => item.id === row.id ? published : item));
      this.message.set('Custom report published.');
    });
  }

  private validatedFilters(keys: readonly FilterKey[], includeLimit = true): ReportFilters | null {
    const values = this.filters;
    const from = keys.includes('from') ? values.from || undefined : undefined;
    const to = keys.includes('to') ? values.to || undefined : undefined;
    const employeeId = keys.includes('employeeId') ? values.employeeId.trim() || undefined : undefined;
    const departmentId = keys.includes('departmentId') ? values.departmentId ?? undefined : undefined;
    const status = keys.includes('status') ? values.status.trim().toUpperCase() || undefined : undefined;
    const limit = includeLimit ? values.limit : undefined;
    if ((from && to && from > to) || (employeeId && !uuid.test(employeeId))
      || (departmentId !== undefined && (!Number.isInteger(departmentId) || departmentId < 1 || departmentId > 2147483647))
      || (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 5000))) {
      this.error.set('Check the date range, worker and department IDs, and row limit.');
      return null;
    }
    return { from, to, employeeId, departmentId, status, limit };
  }

  private reset() {
    this.company.set(null);
    this.section.set(undefined);
    this.forbidden.set('');
    this.error.set('');
    this.message.set('');
    this.busy.set(false);
    this.catalogue.set([]);
    this.search.set('');
    this.selected.set(null);
    this.result.set(null);
    this.files.set([]);
    this.createdFile.set(null);
    this.history.set([]);
    this.templates.set([]);
    this.preview.set(null);
    this.dashboard.set(null);
    this.previous.set(null);
    this.activePeriod.set(null);
    this.filters = freshFilters();
    this.compare = false;
    this.name = '';
    this.fields = [];
    this.format = 'CSV';
  }

  private async request<T>(stream: Observable<T>) {
    const revision = this.revision;
    const result = await firstValueFrom(stream.pipe(takeUntil(this.route.data.pipe(skip(1))), takeUntilDestroyed(this.destroy)));
    if (this.destroy.destroyed || revision !== this.revision) throw new Error('Company workspace changed.');
    return result;
  }

  private async perform(task: (company: number) => Promise<void>) {
    const id = this.company()?.company.id;
    if (!id || this.busy() || this.forbidden()) return;
    const revision = this.revision;
    const done = this.pending.add();
    this.error.set('');
    this.message.set('');
    this.busy.set(true);
    try { await task(id); }
    catch (error) {
      if (!this.destroy.destroyed && revision === this.revision) this.error.set(apiErrorMessage(error));
    } finally {
      if (!this.destroy.destroyed && revision === this.revision) this.busy.set(false);
      done();
    }
  }
}
