import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, Injectable, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { AuthService } from '../../../core/auth/auth.service';
import { PageBreadcrumbComponent } from '../../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import {
  AuditRow, Batch, BATCH_STATUSES, Company, currentRange, DateGrouping, DateRange,
  label, Overview, Policy, RECEIPT_STATUSES, RECEIPT_TYPES, ReceiptStatus, ReceiptType,
  TemplateVersion, VolumeFilter, VolumeRow,
} from '../domain/payslip-supervision.models';
import { PayslipSection } from '../domain/payslip-supervision.navigation';
import { PayslipSupervisionApi } from '../infrastructure/payslip-supervision-api';

@Injectable({ providedIn: 'root' })
class PayslipScope {
  current?: { account: string | undefined; dates: DateRange; company?: Company };
}

@Component({
  selector: 'app-payslip-supervision',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe, DecimalPipe, PageBreadcrumbComponent, ComponentCardComponent],
  templateUrl: './payslip-supervision.component.html',
  styleUrl: './payslip-supervision.css',
})
export class PayslipSupervisionComponent {
  private readonly api = inject(PayslipSupervisionApi);
  private readonly saved = inject(PayslipScope);
  private readonly account = inject(AuthService).claims()?.sub;
  protected readonly section = inject(ActivatedRoute).snapshot.data['section'] as PayslipSection;
  private readonly initial = this.saved.current?.account === this.account ? this.saved.current : undefined;
  protected readonly overview = signal<Overview | null>(null);
  protected readonly volume = signal<VolumeRow[]>([]);
  protected readonly audit = signal<AuditRow[]>([]);
  protected readonly batches = signal<Batch[]>([]);
  protected readonly templates = signal<TemplateVersion[]>([]);
  protected readonly policies = signal<Policy[]>([]);
  protected readonly companies = signal<Company[]>([]);
  protected readonly applied = signal<DateRange>(this.initial?.dates ?? currentRange());
  protected readonly chosen = signal<Company | undefined>(this.initial?.company);
  protected readonly busy = signal(false);
  protected readonly companyBusy = signal(false);
  protected readonly exporting = signal(false);
  protected readonly error = signal('');
  protected readonly companyError = signal('');
  protected readonly exportError = signal('');
  protected readonly grouped = signal<'month' | 'day'>('month');
  protected readonly page = signal(1);
  protected readonly total = signal(0);
  protected readonly limit = 25;
  protected readonly companyPage = signal(1);
  protected readonly companyTotal = signal(0);
  protected readonly companyOnly = ['batches', 'templates', 'policies'].includes(this.section.view);
  protected readonly dated = !['templates', 'policies'].includes(this.section.view);
  protected readonly usesVolume = ['volume', 'reports'].includes(this.section.view);
  protected readonly usesAudit = ['audit', 'portal'].includes(this.section.view);
  protected readonly label = label;
  protected readonly types = RECEIPT_TYPES;
  protected readonly statuses = RECEIPT_STATUSES;
  protected readonly batchStatuses = BATCH_STATUSES;
  protected readonly options = computed(() => {
    const selected = this.chosen();
    const options = this.companies();
    return selected && !options.some(company => company.id === selected.id) ? [selected, ...options] : options;
  });
  protected readonly visibleVolume = computed(() => this.volume().slice((this.page() - 1) * this.limit, this.page() * this.limit));
  protected readonly visibleAudit = computed(() => this.audit().slice((this.page() - 1) * this.limit, this.page() * this.limit));
  protected readonly draft = {
    companyId: this.applied().companyId ?? null as number | null, from: this.applied().from, to: this.applied().to,
    type: '' as ReceiptType | '', status: '' as ReceiptStatus | '', batchStatus: '', granularity: 'month' as DateGrouping,
  };
  protected companySearch = '';
  private committedSearch = '';
  private request = 0;
  private searchRequest = 0;
  private volumeScope?: VolumeFilter;
  private batchStatus = '';

  constructor() {
    void this.searchCompanies(1);
    void this.load();
  }

  protected async searchCompanies(page: number, newSearch = false) {
    if (newSearch) this.committedSearch = this.companySearch.trim();
    const id = ++this.searchRequest;
    this.companyBusy.set(true);
    this.companyError.set('');
    try {
      const result = await firstValueFrom(this.api.companies(this.committedSearch, page));
      if (id !== this.searchRequest) return;
      this.companies.set(result.items);
      this.companyPage.set(result.page);
      this.companyTotal.set(result.total);
    } catch (error) {
      if (id === this.searchRequest) this.companyError.set(apiErrorMessage(error));
    } finally {
      if (id === this.searchRequest) this.companyBusy.set(false);
    }
  }

  protected selectCompany(id: number | null) {
    this.draft.companyId = id;
    this.chosen.set(this.options().find(item => item.id === id));
  }

  protected applyFilters() {
    const from = this.dated ? this.draft.from : this.applied().from;
    const to = this.dated ? this.draft.to : this.applied().to;
    const span = (Date.parse(to) - Date.parse(from)) / 86400000;
    if (!Number.isFinite(span) || span < 0 || span >= 366) {
      this.error.set('Choose a date range of up to 366 days.');
      return;
    }
    const dates = { companyId: this.draft.companyId ?? undefined, from, to };
    this.saved.current = { account: this.account, dates, company: this.chosen() };
    this.applied.set(dates);
    this.grouped.set(this.draft.granularity);
    this.volumeScope = {
      ...dates, granularity: this.grouped(), type: this.section.type || this.draft.type || undefined,
      status: this.section.status || this.draft.status || undefined,
    };
    this.batchStatus = this.draft.batchStatus;
    this.page.set(1);
    void this.load();
  }

  protected turnPage(next: number) {
    this.page.set(next);
    if (this.companyOnly) void this.load();
  }

  protected async load() {
    const id = ++this.request;
    const scope = this.applied();
    this.error.set('');
    this.exportError.set('');
    this.busy.set(true);
    try {
      if (this.companyOnly && !scope.companyId) { this.total.set(0); return; }
      switch (this.section.view) {
        case 'batches': {
          const data = await firstValueFrom(this.api.batches({ ...scope, companyId: scope.companyId! }, this.page(), this.batchStatus, !!this.section.failures));
          if (id === this.request) { this.batches.set(data.items); this.total.set(data.total); }
          break;
        }
        case 'templates': {
          const data = await firstValueFrom(this.api.templates(scope.companyId!, this.page()));
          if (id === this.request) { this.templates.set(data.items); this.total.set(data.total); }
          break;
        }
        case 'policies': {
          const data = await firstValueFrom(this.api.policies(scope.companyId!, this.page()));
          if (id === this.request) { this.policies.set(data.items); this.total.set(data.total); }
          break;
        }
        case 'volume':
        case 'reports': {
          const filters = this.volumeScope ?? { ...scope, granularity: this.grouped(), type: this.section.type, status: this.section.status };
          const rows = await firstValueFrom(this.api.volume(filters));
          if (id === this.request) { this.volumeScope = filters; this.volume.set(rows); this.total.set(rows.length); }
          break;
        }
        case 'portal':
        case 'audit': {
          const rows = await firstValueFrom(this.api.audit(scope, this.grouped()));
          if (id === this.request) {
            const filtered = this.section.view === 'portal' ? rows.filter(row => ['access.VIEW', 'access.DOWNLOAD'].includes(row.event)) : rows;
            this.audit.set(filtered);
            this.total.set(filtered.length);
          }
          break;
        }
        default: {
          const data = await firstValueFrom(this.api.overview(scope));
          if (id === this.request) this.overview.set(data);
        }
      }
    } catch (error) {
      if (id === this.request) this.error.set(apiErrorMessage(error));
    } finally {
      if (id === this.request) this.busy.set(false);
    }
  }

  protected count(data: Overview, category: string, ...states: string[]) {
    return data.metrics.filter(row => row.category === category && states.includes(row.status))
      .reduce((sum, row) => sum + row.total, 0);
  }

  protected totalVolume() {
    return this.volume().reduce((sum, row) => sum + row.total, 0);
  }

  protected percentage(part: number, whole: number) {
    return whole > 0 ? Math.min(part / whole, 1) : 0;
  }

  protected yesNo(value: boolean | null) {
    return value === null ? '—' : value ? 'Yes' : 'No';
  }

  protected async download() {
    const filters = this.volumeScope;
    if (this.exporting() || !filters) return;
    this.exporting.set(true);
    this.exportError.set('');
    try {
      const data = await firstValueFrom(this.api.export(filters));
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'payslips-summary-' + filters.to + '.csv';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { this.exportError.set(apiErrorMessage(error)); }
    finally { this.exporting.set(false); }
  }
}
