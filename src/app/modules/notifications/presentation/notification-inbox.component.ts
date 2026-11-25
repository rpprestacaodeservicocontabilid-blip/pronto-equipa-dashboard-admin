import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { CompanyMembership, CompanyWorkspaceApi } from '../../../core/api/company-workspace-api';
import { apiErrorMessage } from '../../../core/api/api-error';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { PageBreadcrumbComponent } from '../../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { NotificationInbox } from '../application/notification-inbox.service';
import { InboxFilter, InboxItem, NotificationChannel, NotificationPreference, NotificationRecord, notificationCategories,
  notificationChannels, notificationLabel } from '../domain/notifications.models';
import { NotificationsApi } from '../infrastructure/notifications-api.service';

@Component({
  selector: 'app-notification-inbox',
  standalone: true,
  imports: [DatePipe, NgTemplateOutlet, FormsModule, RouterLink, ComponentCardComponent, PageBreadcrumbComponent],
  templateUrl: './notification-inbox.component.html',
  styleUrl: './notifications.css',
})
export class NotificationInboxComponent {
  private readonly api = inject(NotificationsApi);
  private readonly workspace = inject(CompanyWorkspaceApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly inbox = inject(NotificationInbox);
  protected readonly preferencePage = Boolean(this.route.snapshot.data['preferences']);
  protected readonly companies = signal<CompanyMembership[] | null>(null);
  protected readonly loadingCompanies = signal(false);
  protected readonly company = signal<number | null>(null);
  protected readonly entries = signal<InboxItem[]>([]);
  protected readonly detail = signal<InboxItem | null>(null);
  protected readonly preferences = signal<NotificationPreference[]>([]);
  protected readonly preferencesReady = signal(false);
  protected readonly history = signal<NotificationRecord[] | null>(null);
  protected readonly error = signal('');
  protected readonly loading = signal(false);
  protected readonly writing = signal(false);
  protected readonly categories = notificationCategories;
  protected readonly channels = notificationChannels;
  protected readonly label = notificationLabel;
  protected readonly filters: InboxFilter[] = ['', 'UNREAD', 'READ', 'ARCHIVED'];
  protected category: string = notificationCategories[0];
  protected state: InboxFilter = '';
  protected page = 1;
  private entry = '';
  private revision = 0;

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(query => {
      const company = Number(query.get('companyId'));
      this.company.set(Number.isInteger(company) && company > 0 && company <= 2147483647 ? company : null);
      this.entry = query.get('entry') ?? '';
      this.inbox.select(this.company());
      this.page = 1;
      this.history.set(null);
      this.load();
    });
  }

  protected findCompanies() {
    this.loadingCompanies.set(true);
    this.workspace.companies().pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loadingCompanies.set(false))).subscribe({
      next: result => this.companies.set(result.filter(item => item.status === 'ACTIVE')),
      error: error => this.error.set(apiErrorMessage(error)),
    });
  }

  protected choose(value: number | null) {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { companyId: value } });
  }

  protected browse(page: number) { this.page = page; this.load(); }
  protected filter(state: InboxFilter) { this.state = state; this.browse(1); }

  private load() {
    const revision = ++this.revision;
    this.error.set('');
    this.loading.set(true);
    this.entries.set([]);
    this.preferences.set([]);
    this.preferencesReady.set(false);
    this.detail.set(null);
    if (this.preferencePage) {
      this.api.preferences(this.company()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: rows => {
          if (revision !== this.revision) return;
          this.preferences.set(rows.map(row => row.data));
          this.preferencesReady.set(true);
          this.loading.set(false);
        },
        error: error => this.fail(error, revision),
      });
      return;
    }
    this.api.inbox(this.company(), this.page, this.state).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: rows => {
        if (revision !== this.revision) return;
        this.entries.set(rows);
        this.loading.set(false);
        this.inbox.refresh();
        const listed = rows.find(item => item.id === this.entry);
        if (listed) this.detail.set(listed);
        else if (this.entry) this.api.item(this.company(), this.entry).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: item => { if (revision === this.revision) this.detail.set(item); },
            error: error => this.fail(error, revision),
          });
      },
      error: error => this.fail(error, revision),
    });
  }

  protected mark(action: 'read' | 'archive' | 'read-all', id?: string) {
    const revision = this.revision;
    this.writing.set(true);
    this.api.mark(this.company(), action, id).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.writing.set(false))).subscribe({
      next: () => { if (revision === this.revision) this.load(); },
      error: error => this.fail(error, revision),
    });
  }

  protected preferenceEnabled(channel: NotificationChannel) {
    return this.preferences().find(preference => preference.category === this.category && preference.channel === channel)?.enabled ?? true;
  }

  protected changePreference(channel: NotificationChannel, event: Event) {
    const checkbox = event.target as HTMLInputElement;
    const input = { category: this.category, channel, enabled: checkbox.checked };
    checkbox.checked = !input.enabled;
    const revision = this.revision;
    this.error.set('');
    this.writing.set(true);
    this.api.savePreference(this.company(), input).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.writing.set(false))).subscribe({
      next: () => {
        if (revision !== this.revision) return;
        this.preferences.update(rows => [...rows.filter(row => row.category !== input.category || row.channel !== channel), input]);
        this.history.set(null);
      },
      error: error => this.fail(error, revision),
    });
  }

  protected loadHistory() {
    const revision = this.revision;
    this.api.preferenceHistory(this.company()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => { if (revision === this.revision) this.history.set(data); },
      error: error => this.fail(error, revision),
    });
  }

  private fail(error: unknown, revision: number) {
    if (revision !== this.revision) return;
    this.loading.set(false);
    this.error.set(apiErrorMessage(error));
  }
}
