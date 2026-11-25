import { DatePipe, DecimalPipe, KeyValuePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, finalize } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { AuthService } from '../../../core/auth/auth.service';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { PageBreadcrumbComponent } from '../../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { downloadWorkbook } from '../../../shared/utils/report-documents';
import { NotificationCompany, NotificationPage, NotificationPolicy, NotificationProviderView, NotificationRecord, NotificationReport,
  NotificationSettings, notificationChannels, notificationLabel } from '../domain/notifications.models';
import { notificationGrant, NotificationsSection } from '../domain/notifications.navigation';
import { NotificationsApi } from '../infrastructure/notifications-api.service';
import { NotificationCommandComponent, NotificationCommand } from './notification-command.component';

const statuses: Record<string, string[]> = {
  messages: ['PENDING', 'SCHEDULED', 'COMPLETED', 'PARTIALLY_COMPLETED', 'CANCELLED'],
  campaigns: ['PENDING', 'SCHEDULED', 'COMPLETED', 'PARTIALLY_COMPLETED', 'CANCELLED'],
  deliveries: ['QUEUED', 'ACCEPTED', 'DELIVERED', 'FAILED_PERMANENT', 'UNKNOWN', 'SUPPRESSED', 'CANCELLED'],
  templates: ['DRAFT', 'PUBLISHED'],
  rules: ['ACTIVE', 'DISABLED'],
};
type SectionData = NotificationPage<NotificationRecord> | NotificationReport | NotificationProviderView[] | NotificationPolicy[] | NotificationSettings;

@Component({
  selector: 'app-notification-admin',
  standalone: true,
  imports: [DatePipe, DecimalPipe, KeyValuePipe, FormsModule, PageBreadcrumbComponent, ComponentCardComponent, NotificationCommandComponent],
  templateUrl: './notification-admin.component.html',
  styleUrl: './notifications.css',
})
export class NotificationAdminComponent {
  private readonly api = inject(NotificationsApi);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly section = this.route.snapshot.data['section'] as NotificationsSection;
  protected readonly company = signal<number | null>(null);
  protected readonly scopeName = computed(() => {
    const company = this.company();
    return company ? this.companyLabel()?.name || 'Company #' + company : 'Platform';
  });
  protected readonly companies = signal<NotificationPage<NotificationCompany> | null>(null);
  protected readonly companyLabel = signal<NotificationCompany | null>(null);
  protected readonly picker = signal(false);
  protected readonly pickerBusy = signal(false);
  protected readonly pickerError = signal('');
  protected readonly result = signal<SectionData | null>(null);
  protected readonly details = signal<NotificationRecord[] | null>(null);
  protected readonly selected = signal<NotificationRecord | null>(null);
  protected readonly command = signal<{ action: NotificationCommand; row: NotificationRecord | null } | null>(null);
  protected readonly commands = computed(() => {
    const command = this.command();
    return command ? [command] : [];
  });
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly busy = signal(false);
  protected readonly actionBusy = signal(false);
  protected readonly exporting = signal(false);
  protected readonly label = notificationLabel;
  protected readonly channels = notificationChannels;
  protected readonly options = this.section.status ? [] : statuses[this.section.endpoint] ?? [];
  protected search = '';
  protected status = '';
  protected channel = '';
  protected page = 1;
  private revision = 0;
  private detailRevision = 0;

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(query => {
      const company = Number(query.get('companyId'));
      this.company.set(!this.section.platformOnly && Number.isInteger(company) && company > 0 && company <= 2147483647 ? company : null);
      this.companyLabel.update(previous => previous?.id === this.company() ? previous : null);
      this.picker.set(false);
      this.notice.set('');
      this.load(1);
    });
  }

  protected can(permission: string) { return this.auth.claims()?.permissions.includes(notificationGrant(permission)) ?? false; }
  protected table() { return this.result() as NotificationPage<NotificationRecord> | null; }
  protected report() { return this.result() as NotificationReport | null; }
  protected providers() { return this.result() as NotificationProviderView[] | null; }
  protected policies() { return this.result() as NotificationPolicy[] | null; }
  protected settings() { return this.result() as NotificationSettings | null; }

  protected findCompanies(page = 1) {
    this.picker.set(true);
    this.pickerBusy.set(true);
    this.pickerError.set('');
    this.api.companies(this.search.trim(), page).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.pickerBusy.set(false))).subscribe({
      next: result => this.companies.set(result),
      error: error => this.pickerError.set(apiErrorMessage(error)),
    });
  }

  protected choose(company: NotificationCompany | null) {
    this.companyLabel.set(company);
    this.picker.set(false);
    void this.router.navigate([], { relativeTo: this.route, queryParams: { companyId: company?.id ?? null } });
  }

  protected load(page = this.page) {
    const revision = ++this.revision;
    this.page = page;
    this.command.set(null);
    this.selected.set(null);
    this.details.set(null);
    this.result.set(null);
    this.error.set('');
    this.busy.set(false);
    if (this.section.endpoint === 'rules' && this.company() === null) return;
    this.busy.set(true);
    this.fetch().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => {
        if (revision !== this.revision) return;
        this.result.set(result);
        this.busy.set(false);
      },
      error: error => {
        if (revision !== this.revision) return;
        this.busy.set(false);
        this.error.set(apiErrorMessage(error));
      },
    });
  }

  private fetch(): Observable<SectionData> {
    const company = this.company();
    switch (this.section.view) {
      case 'providers': return this.api.providers();
      case 'policy': return this.api.policy(company);
      case 'settings': return this.api.settings();
      case 'report': return this.api.report(company, this.section.endpoint);
      case 'list': return this.api.list(company, this.section.endpoint, this.page, this.section.status ?? this.status, this.channel);
    }
  }

  protected field(row: NotificationRecord, key: string) {
    const value = key === 'period' ? row.period : row.data[key];
    if (Array.isArray(value)) return value.map(item => typeof item === 'string' ? this.label(item) : String(item)).join(', ');
    if (key === 'scheduledAt' && typeof value === 'string') {
      return new DatePipe('en').transform(value, 'medium', '+0100') ?? value;
    }
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number') return String(value);
    return typeof value === 'string' && value ? value : '—';
  }

  protected inspect(row: NotificationRecord) {
    this.selected.set(row);
    this.details.set(null);
    this.error.set('');
    const revision = this.revision;
    const detailRevision = ++this.detailRevision;
    const suffix = row.kind === 'DELIVERY' ? 'attempts' : row.kind === 'TEMPLATE' ? 'versions' : '';
    if (!suffix) return;
    this.api.records(this.company(), this.section.endpoint + '/' + row.id + '/' + suffix).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => { if (revision === this.revision && detailRevision === this.detailRevision) this.details.set(result); },
      error: error => { if (revision === this.revision && detailRevision === this.detailRevision) this.error.set(apiErrorMessage(error)); },
    });
  }

  protected start(action: NotificationCommand, row: NotificationRecord | null = null) {
    this.notice.set('');
    this.command.set({ action, row });
  }

  protected finish(message: string) {
    this.notice.set(message);
    this.load(this.page);
  }

  protected exportReport() {
    this.exporting.set(true);
    const scope = this.scopeName();
    const revision = this.revision;
    this.api.report(this.company(), 'reports/export').pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.exporting.set(false))).subscribe({
      next: data => {
        if (revision !== this.revision) return;
        downloadWorkbook('prontoequipas-notifications', {
          title: 'Notification delivery report', company: scope, headings: ['Metric', 'Count'],
          rows: [['Notifications', data.messages], ['Deliveries', data.totalDeliveries],
            ...Object.entries(data.byStatus).map(([key, count]) => ['Status · ' + this.label(key), count]),
            ...Object.entries(data.byChannel).map(([key, count]) => ['Channel · ' + this.label(key), count])],
        });
      },
      error: error => { if (revision === this.revision) this.error.set(apiErrorMessage(error)); },
    });
  }
}
