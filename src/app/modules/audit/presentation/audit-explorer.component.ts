import { DatePipe, DecimalPipe, JsonPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { CompanyMembership, CompanyWorkspaceApi } from '../../../core/api/company-workspace-api';
import { AuthService } from '../../../core/auth/auth.service';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { PageBreadcrumbComponent } from '../../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { AuditPurpose } from '../application/audit-purpose.service';
import { AuditDashboard, AuditFilters, AuditRecord, AuditRecordPage, AuditScope, auditCategories, auditLabel, auditOutcomes, auditSeverities } from '../domain/audit.models';
import { AUDIT_READ, auditGrant, AuditSection } from '../domain/audit.navigation';
import { AuditApi } from '../infrastructure/audit-api.service';
import { AuditPurposeComponent } from './audit-purpose.component';

interface AppliedSearch { scope: AuditScope; filters: AuditFilters; path: string; context: object }
const DAY = 86400000;
const luandaDate = (time: number) => new Date(time + 3600000).toISOString().slice(0, 10);

@Component({
  selector: 'app-audit-explorer',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe, DecimalPipe, JsonPipe, ComponentCardComponent, PageBreadcrumbComponent, AuditPurposeComponent],
  templateUrl: './audit-explorer.component.html',
  styleUrl: './audit.css',
})
export class AuditExplorerComponent implements OnInit {
  private readonly api = inject(AuditApi);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  protected readonly purpose = inject(AuditPurpose);
  private readonly membership = inject(CompanyWorkspaceApi);
  protected readonly section = this.route.snapshot.data['section'] as AuditSection;
  protected readonly label = auditLabel;
  protected readonly categories = auditCategories;
  protected readonly severities = auditSeverities;
  protected readonly outcomes = auditOutcomes;
  protected readonly companies = signal<CompanyMembership[]>([]);
  protected readonly companyError = signal('');
  protected readonly loadingCompanies = signal(false);
  protected readonly page = signal<AuditRecordPage | null>(null);
  protected readonly dashboard = signal<AuditDashboard | null>(null);
  protected readonly openRecord = signal<AuditRecord | null>(null);
  protected readonly busy = signal(false);
  protected readonly detailsBusy = signal(false);
  protected readonly exportBusy = signal(false);
  protected readonly error = signal('');
  protected readonly detailError = signal('');
  protected readonly exportError = signal('');
  protected readonly exportId = signal('');
  protected readonly reviewExport = signal(false);
  protected readonly categoryCounts = computed(() => Object.entries(this.dashboard()?.categories ?? {}).sort((a, b) => b[1] - a[1]));
  protected readonly peakDaily = computed(() => Math.max(1, ...(this.dashboard()?.daily ?? []).map(day => day.events)));
  protected readonly recordMetrics = [
    ['events', 'Visible events'], ['critical', 'Critical events'], ['denied', 'Denied actions'],
    ['failures', 'Failed actions'], ['withoutCorrelation', 'Without correlation'],
  ] as const;
  protected companyId: number | null = null;
  protected filters: AuditFilters = {};
  protected fromDate = luandaDate(Date.now() - 6 * DAY);
  protected toDate = luandaDate(Date.now());
  private active: AppliedSearch | null = null;
  private cursors: Array<number | undefined> = [undefined];
  private searchVersion = 0;
  private detailsVersion = 0;

  ngOnInit() {
    const query = this.route.snapshot.queryParamMap;
    for (const field of ['actorId', 'resourceType', 'resourceId', 'correlationId'] as const) {
      const value = query.get(field);
      if (value) this.filters[field] = value.slice(0, 200);
    }
    if (this.section.company) void this.loadCompanies();
    else if (this.purpose.value() && this.canSearch) void this.search();
  }

  protected can(code: string) { return this.auth.claims()?.permissions.includes(auditGrant(code)) ?? false; }
  protected get hasPrevious() { return this.cursors.length > 1; }
  protected get pageNumber() { return this.cursors.length; }
  protected get canSearch() {
    return !!this.purpose.value() && (!this.section.company || this.companyId !== null) &&
      (this.section.lookup !== 'actor' || !!this.filters.actorId?.trim()) &&
      (this.section.lookup !== 'resource' || (!!this.filters.resourceType?.trim() && !!this.filters.resourceId?.trim())) &&
      (this.section.lookup !== 'correlation' || !!this.filters.correlationId?.trim());
  }
  protected get canExport() {
    return !this.section.company && this.can('exports:create') &&
      (this.section.endpoint.startsWith('reports/') ? this.can('reports:export') : true) &&
      ((this.page()?.data.length ?? this.dashboard()?.events ?? 0) > 0);
  }

  protected async loadCompanies() {
    this.loadingCompanies.set(true);
    this.companyError.set('');
    try { this.companies.set((await firstValueFrom(this.membership.companies())).filter(company => company.status === 'ACTIVE')); }
    catch (error) { this.companyError.set(apiErrorMessage(error)); }
    finally { this.loadingCompanies.set(false); }
  }

  protected chooseCompany(id: number | null) {
    this.companyId = id;
    this.clear();
    if (this.canSearch) void this.search();
  }

  protected purposeChanged() {
    this.clear();
    if (this.canSearch) void this.search();
  }

  protected async search() {
    const context = this.purpose.current();
    if (!context || !this.canSearch) return;
    this.clear();
    if (this.fromDate && this.toDate && this.fromDate > this.toDate) {
      this.error.set('Choose an end date on or after the start date.');
      return;
    }
    const from = this.fromDate ? new Date(this.fromDate + 'T00:00:00.000+01:00').toISOString() : undefined;
    const to = this.toDate ? new Date(this.toDate + 'T23:59:59.999+01:00').toISOString() : undefined;
    const filters = { ...this.filters, from, to, ...this.section.preset };
    for (const key of ['actorId', 'resourceType', 'resourceId', 'correlationId', 'module', 'eventType', 'action'] as const) {
      filters[key] = filters[key]?.trim() || undefined;
    }
    const path = this.lookupPath(filters);
    const scope = { purpose: context.purpose, companyId: this.companyId ?? undefined };
    this.active = { scope, filters, path, context };
    await this.load();
  }

  protected async next() {
    const page = this.page();
    if (!page || page.nextCursor === null || this.busy()) return;
    const cursors = [...this.cursors, page.nextCursor];
    if (await this.load(page.nextCursor, page.throughSequence)) this.cursors = cursors;
  }

  protected async previous() {
    const page = this.page();
    if (!page || !this.hasPrevious || this.busy()) return;
    const cursors = this.cursors.slice(0, -1);
    if (await this.load(cursors.at(-1), page.throughSequence)) this.cursors = cursors;
  }

  protected async detail(row: AuditRecord) {
    const active = this.active;
    if (!active || active.context !== this.purpose.current()) return;
    this.closeDetail();
    if (!this.auth.claims()?.permissions.includes(AUDIT_READ)) {
      this.openRecord.set(row);
      return;
    }
    const request = this.detailsVersion;
    this.detailsBusy.set(true);
    try {
      const result = await firstValueFrom(this.api.record(active.scope, row.id));
      if (request === this.detailsVersion && active.context === this.purpose.current()) this.openRecord.set(result);
    } catch (error) {
      if (request === this.detailsVersion) this.detailError.set(apiErrorMessage(error));
    } finally {
      if (request === this.detailsVersion) this.detailsBusy.set(false);
    }
  }

  protected closeDetail() {
    this.detailsVersion++;
    this.openRecord.set(null);
    this.detailError.set('');
    this.detailsBusy.set(false);
  }

  protected async requestExport() {
    const active = this.active;
    if (!active || active.context !== this.purpose.current() || !this.canExport || this.exportBusy()) return;
    const version = this.searchVersion;
    this.exportBusy.set(true);
    this.exportError.set('');
    this.exportId.set('');
    try {
      const endpoint = this.section.endpoint.startsWith('reports/') ? this.section.endpoint + '/exports' : 'exports';
      const throughSequence = this.page()?.throughSequence ?? this.dashboard()?.asOfSequence;
      const result = await firstValueFrom(this.api.post<{ id: string }>(active.scope, endpoint, { filter: { ...active.filters, throughSequence } }));
      if (version === this.searchVersion && active.context === this.purpose.current()) {
        this.exportId.set(result.id);
        this.reviewExport.set(false);
      }
    } catch (error) {
      if (version === this.searchVersion) this.exportError.set(apiErrorMessage(error));
    } finally { this.exportBusy.set(false); }
  }

  private clear() {
    this.searchVersion++;
    this.active = null;
    this.cursors = [undefined];
    this.page.set(null);
    this.dashboard.set(null);
    this.error.set('');
    this.exportError.set('');
    this.reviewExport.set(false);
    this.exportId.set('');
    this.busy.set(false);
    this.closeDetail();
  }

  private async load(cursor?: number, throughSequence?: number) {
    const active = this.active;
    if (!active || active.context !== this.purpose.current()) return false;
    const request = ++this.searchVersion;
    this.busy.set(true);
    this.error.set('');
    this.closeDetail();
    try {
      if (this.section.view === 'dashboard') {
        const value = await firstValueFrom(this.api.dashboard(active.scope, active.path, active.filters));
        if (request === this.searchVersion && active.context === this.purpose.current()) this.dashboard.set(value);
      } else {
        const value = await firstValueFrom(this.api.records(active.scope, active.path, active.filters, cursor, throughSequence));
        if (request === this.searchVersion && active.context === this.purpose.current()) this.page.set(value);
      }
      return request === this.searchVersion && active.context === this.purpose.current();
    } catch (error) {
      if (request === this.searchVersion) this.error.set(apiErrorMessage(error));
      return false;
    } finally {
      if (request === this.searchVersion) this.busy.set(false);
    }
  }

  private lookupPath(filters: AuditFilters) {
    const part = (value: string | undefined) => encodeURIComponent(value?.trim() ?? '');
    switch (this.section.lookup) {
      case 'actor': return 'actors/' + part(filters.actorId) + '/activity';
      case 'correlation': return 'correlations/' + part(filters.correlationId);
      case 'resource': return 'resources/' + part(filters.resourceType) + '/' + part(filters.resourceId) + '/history';
      default: return this.section.endpoint;
    }
  }
}
