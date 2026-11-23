import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { AuthService } from '../../../core/auth/auth.service';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { PageBreadcrumbComponent } from '../../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { downloadWorkbook } from '../../../shared/utils/report-documents';
import { SupportWorkspace } from '../application/support-workspace.service';
import { directoryActions, directoryCreate, SupportAction } from '../domain/support-forms';
import { priorities, SupportCompany, SupportDashboard, supportLabel, SupportPage, SupportRow, SupportTicket, TicketQuery, ticketStatuses, ticketTypes } from '../domain/support.models';
import { supportGrant, SupportSection } from '../domain/support.navigation';
import { SupportApi } from '../infrastructure/support-api.service';
import { SupportActionComponent } from './support-action.component';
import { SupportCompanyPickerComponent } from './support-company-picker.component';

@Component({
  selector: 'app-support-section',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, RouterLink, ComponentCardComponent, PageBreadcrumbComponent, SupportActionComponent, SupportCompanyPickerComponent],
  templateUrl: './support-section.component.html',
  styleUrl: './support.css',
})
export class SupportSectionComponent implements OnInit {
  private readonly api = inject(SupportApi);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly workspace = inject(SupportWorkspace);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly section = this.route.snapshot.data['section'] as SupportSection;
  protected readonly company = this.workspace.company;
  protected readonly dashboard = signal<SupportDashboard | null>(null);
  protected readonly page = signal<SupportPage<SupportTicket> | null>(null);
  protected readonly rows = signal<SupportRow[] | null>(null);
  protected readonly selected = signal<SupportRow | null>(null);
  protected readonly action = signal<SupportAction | null>(null);
  protected readonly busy = signal(false);
  protected readonly writing = signal(false);
  protected readonly error = signal('');
  protected readonly actionError = signal('');
  protected readonly notice = signal('');
  protected readonly newAction = this.createAction();
  protected readonly actions = computed(() => {
    const row = this.selected();
    return row ? directoryActions(this.section.endpoint, row).filter(action => this.can(action.grant)) : [];
  });
  protected readonly states = ticketStatuses;
  protected readonly priorities = priorities;
  protected readonly types = ticketTypes;
  protected readonly label = supportLabel;
  protected readonly details = ['description', 'content', 'cause', 'resolution', 'reason', 'message'] as const;
  protected filters: TicketQuery = {};
  protected search = '';
  private appliedFilters: TicketQuery = {};
  private appliedSearch = '';
  private version = 0;

  ngOnInit() {
    if (this.section.global) { this.apply(); return; }
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const id = Number(params.get('companyId'));
      if (Number.isSafeInteger(id) && id > 0 && id <= 2147483647 && this.company()?.id !== id)
        this.workspace.choose({ id, name: 'Company' });
      this.resetScope();
      this.apply();
    });
  }

  protected can(code: string) { return this.auth.claims()?.permissions.includes(supportGrant(code)) ?? false; }
  protected entries(values: Record<string, number>) { return Object.entries(values); }
  protected metrics(data: SupportDashboard): Array<[string, number | null]> {
    return [
      ['Open tickets', data.open], ['In progress', data.inProgress], ['Resolved today', data.resolvedToday],
      ['SLA breaches', data.breached], ['Average first response (min)', data.averageResponseMinutes],
      ['Average resolution (min)', data.averageResolutionMinutes], ['Customer ratings', data.satisfaction.responses],
    ];
  }
  protected text(value: unknown): string {
    if (Array.isArray(value)) return value.map(item => String(item)).join(', ');
    return typeof value === 'string' || typeof value === 'number' ? String(value) : '—';
  }

  protected choose(company: SupportCompany) {
    this.workspace.choose(company);
    this.resetScope();
    if (Number(this.route.snapshot.queryParamMap.get('companyId')) === company.id) {
      this.apply();
    } else {
      void this.router.navigate([], { relativeTo: this.route, queryParams: { companyId: company.id }, queryParamsHandling: 'merge' });
    }
  }

  private resetScope() {
    this.version++;
    this.selected.set(null);
    this.action.set(null);
    this.notice.set('');
    this.actionError.set('');
    this.error.set('');
    this.dashboard.set(null);
    this.page.set(null);
    this.rows.set(null);
    this.busy.set(false);
  }

  protected apply() {
    this.appliedFilters = { ...this.filters, ...this.section.preset };
    this.appliedSearch = this.search.trim();
    void this.load(1);
  }

  protected async load(page = this.page()?.page ?? 1) {
    const company = this.company();
    if (!company && !this.section.global) return;
    const version = ++this.version;
    this.busy.set(true);
    this.error.set('');
    this.dashboard.set(null);
    this.page.set(null);
    this.rows.set(null);
    try {
      if (this.section.view === 'dashboard') {
        const result = await firstValueFrom(this.api.dashboard(company!.id, this.section.endpoint));
        if (version === this.version) this.dashboard.set(result);
      } else if (this.section.view === 'tickets') {
        const result = this.section.endpoint === 'tickets'
          ? await firstValueFrom(this.api.tickets(company!.id, this.appliedFilters, page))
          : await firstValueFrom(this.api.slaTickets(company!.id, this.section.endpoint)).then(data => ({ data, page: 1, limit: data.length, total: data.length }));
        if (version === this.version) this.page.set(result);
      } else {
        const result = await firstValueFrom(this.api.directory(this.section.global ? null : company!.id, this.section.endpoint, this.appliedSearch));
        if (version === this.version) {
          this.rows.set(result);
          const id = this.selected()?.id;
          this.selected.set(result.find(row => row.id === id) ?? null);
        }
      }
    } catch (error) {
      if (version === this.version) this.error.set(apiErrorMessage(error));
    } finally { if (version === this.version) this.busy.set(false); }
  }

  protected open(action: SupportAction) {
    this.actionError.set('');
    this.action.set(action);
  }

  protected async submit(body: Record<string, unknown>) {
    const action = this.action(), company = this.company();
    if (!action || !this.can(action.grant) || this.writing() || (!this.section.global && !company)) return;
    this.writing.set(true);
    this.actionError.set('');
    this.notice.set('');
    try {
      await firstValueFrom(this.api.request(this.section.global ? null : company!.id, action.method ?? 'POST', action.path, body));
      if (!this.section.global && this.company() !== company) return;
      this.action.set(null);
      this.notice.set('Changes saved.');
      await this.load();
    } catch (error) { this.actionError.set(apiErrorMessage(error)); }
    finally { this.writing.set(false); }
  }

  protected async exportReport() {
    const company = this.company();
    if (!company || this.writing() || this.section.path !== 'reports' || !this.can('reports:export')) return;
    this.writing.set(true);
    this.actionError.set('');
    try {
      const data = await firstValueFrom(this.api.dashboard(company.id, 'reports/export'));
      if (this.company() !== company) return;
      downloadWorkbook('prontoequipas-support-' + company.id, {
        title: 'PRONTOEQUIPAS — Support report', company: company.name, headings: ['Metric', 'Value'],
        rows: [...this.metrics(data), ['Average rating', data.satisfaction.responses ? data.satisfaction.average : null],
          ...Object.entries(data.byStatus).map(([key, value]) => ['Status · ' + supportLabel(key), value]),
          ...Object.entries(data.byPriority).map(([key, value]) => ['Priority · ' + supportLabel(key), value])],
      });
    } catch (error) { this.actionError.set(apiErrorMessage(error)); }
    finally { this.writing.set(false); }
  }

  private createAction(): SupportAction | null {
    const definition = directoryCreate[this.section.endpoint];
    if (!definition) return null;
    return { ...definition, path: this.section.endpoint,
      fields: this.section.path === 'global-knowledge' ? definition.fields.map(field =>
        field.key === 'visibility' ? { ...field, initial: 'PUBLIC' } : field) : definition.fields,
    };
  }
}
