import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { PageBreadcrumbComponent } from '../../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { currentScope, Definition, Grouping, Observation, Preview, ReportCode, ReportRequest, Scope } from '../domain/platform-reports.models';
import { ReportSection } from '../domain/platform-reports.navigation';
import { PlatformReportsApi } from '../infrastructure/platform-reports-api';
import { ReportCompanyPickerComponent } from './report-company-picker.component';
import { ReportResultTableComponent } from './report-result-table.component';

@Component({
  selector: 'app-report-explorer',
  standalone: true,
  imports: [FormsModule, RouterLink, DecimalPipe, DatePipe, PageBreadcrumbComponent, ComponentCardComponent, ReportCompanyPickerComponent, ReportResultTableComponent],
  templateUrl: './report-explorer.component.html',
  styleUrl: './platform-reports.css',
})
export class ReportExplorerComponent {
  private readonly api = inject(PlatformReportsApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly section = this.route.snapshot.data['section'] as ReportSection;
  protected readonly catalog = signal<Definition[]>([]);
  protected readonly code = signal<ReportCode>('REPORT_ACTIVITY');
  protected readonly result = signal<Preview | null>(null);
  protected readonly applied = signal<ReportRequest | null>(null);
  protected readonly busy = signal(false);
  protected readonly running = signal(false);
  protected readonly error = signal('');
  protected readonly catalogError = signal('');
  protected readonly search = signal('');
  protected readonly definition = computed(() => this.catalog().find(item => item.code === this.code()));
  protected readonly matches = computed(() => {
    const query = this.search().trim().toLowerCase();
    return this.catalog().filter(item => [item.title, item.category, item.source].some(value => value.toLowerCase().includes(query)));
  });
  protected readonly trend = computed(() => {
    const values = new Map<string, number>();
    for (const row of this.result()?.rows ?? []) {
      if (this.section.view === 'overview' && (row.category !== 'EXECUTION' || row.state !== 'COMPLETED')) continue;
      values.set(row.period, (values.get(row.period) ?? 0) + row.count);
    }
    return [...values].sort(([a], [b]) => a.localeCompare(b)).slice(-12)
      .map(([period, count]) => ({ period, count }));
  });
  protected readonly maxTrend = computed(() => Math.max(1, ...this.trend().map(row => row.count)));
  protected readonly filters: Scope = currentScope();
  protected compare = true;
  private operation?: { request: string; key: string };

  constructor() { void this.start(); }

  protected async start() {
    this.catalogError.set('');
    try {
      const definitions = await firstValueFrom(this.api.catalog);
      this.catalog.set(definitions);
      if (this.section.view === 'catalog') return;
      const query = this.route.snapshot.queryParamMap;
      const code = this.section.code ?? query.get('code');
      this.code.set(definitions.find(item => item.code === code)?.code ?? 'REPORT_ACTIVITY');
      const from = query.get('from');
      const to = query.get('to');
      const grouping = query.get('grouping');
      const company = Number(query.get('companyId'));
      if (from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) Object.assign(this.filters, { from, to });
      if (grouping === 'month' || grouping === 'day') this.filters.grouping = grouping as Grouping;
      if (Number.isSafeInteger(company) && company > 0) this.filters.companyId = company;
      await this.preview();
    } catch (error) { this.catalogError.set(apiErrorMessage(error)); }
  }

  protected select(code: ReportCode) {
    this.code.set(code);
    this.result.set(null);
    this.applied.set(null);
    this.error.set('');
  }

  private request(): ReportRequest {
    return { code: this.code(), scope: { ...this.filters, companyId: this.definition()?.companyFilter ? this.filters.companyId : undefined } };
  }

  protected async preview() {
    if (this.busy() || this.running()) return;
    const input = this.request();
    this.error.set('');
    if (!input.scope.from || !input.scope.to || input.scope.from > input.scope.to) {
      this.applied.set(null);
      this.result.set(null);
      this.error.set('Enter a start date and an end date in order.');
      return;
    }
    this.busy.set(true);
    try {
      const result = await firstValueFrom(this.api.preview(input, this.compare));
      this.applied.set(input);
      this.result.set(result);
    } catch (error) {
      this.result.set(null);
      this.applied.set(null);
      this.error.set(apiErrorMessage(error));
    } finally { this.busy.set(false); }
  }

  protected async run() {
    if (this.running() || this.busy()) return;
    const input = this.applied();
    if (!input) return;
    this.running.set(true);
    this.error.set('');
    const request = JSON.stringify(input);
    if (this.operation?.request !== request) this.operation = { request, key: crypto.randomUUID() };
    try {
      const row = await firstValueFrom(this.api.run(input, this.operation.key));
      this.operation = undefined;
      await this.router.navigate(['/reports/executions'], { queryParams: { id: row.id } });
    } catch (error) { this.error.set(apiErrorMessage(error)); }
    finally { this.running.set(false); }
  }

  protected count(rows: Observation[], category?: string, status?: string) {
    return rows.reduce((sum, row) => sum + ((!category || row.category === category) && (!status || row.state === status) ? row.count : 0), 0);
  }
}
