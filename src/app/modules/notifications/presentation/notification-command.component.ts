import { Component, DestroyRef, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Observable, catchError, finalize, of } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { NotificationChannel, NotificationRecord, TemplatePreview, manualCategories, notificationCategories,
  notificationLabel, templateKeys } from '../domain/notifications.models';
import { NotificationsApi } from '../infrastructure/notifications-api.service';

export type NotificationCommand = 'draft' | 'edit' | 'preview' | 'publish' | 'campaign' | 'cancel' | 'retry' | 'rule';
const titles: Record<NotificationCommand, string> = {
  draft: 'Create a template draft', edit: 'Edit template draft', preview: 'Preview template', publish: 'Publish template',
  campaign: 'Queue a campaign', cancel: 'Cancel notification', retry: 'Retry delivery', rule: 'Save automatic rule',
};
const outcomes: Record<NotificationCommand, string> = {
  draft: 'Draft created.', edit: 'Draft updated.', preview: '', publish: 'Template published.',
  campaign: 'Campaign queued.', cancel: 'Notification cancelled.', retry: 'Delivery queued for retry.', rule: 'Automatic rule saved.',
};

@Component({
  selector: 'app-notification-command',
  standalone: true,
  imports: [FormsModule, ComponentCardComponent],
  templateUrl: './notification-command.component.html',
  styleUrl: './notifications.css',
})
export class NotificationCommandComponent implements OnInit {
  @Input() action: NotificationCommand = 'draft';
  @Input() row: NotificationRecord | null = null;
  @Input() company: number | null = null;
  @Input() scopeName = '';
  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly saved = new EventEmitter<string>();
  @Output() readonly working = new EventEmitter<boolean>();
  private readonly api = inject(NotificationsApi);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly templates = signal<NotificationRecord[]>([]);
  protected readonly templatesBusy = signal(false);
  protected readonly templatePage = signal(1);
  protected readonly moreTemplates = signal(false);
  protected readonly options = signal<NotificationChannel[]>(['IN_APP']);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly preview = signal<TemplatePreview | null>(null);
  protected readonly categories = notificationCategories;
  protected readonly label = notificationLabel;
  protected readonly titles = titles;
  protected code = '';
  protected category = 'ANNOUNCEMENT';
  protected eventType = '';
  protected subject = '';
  protected body = '';
  protected recipients = '';
  protected scheduled = '';
  protected enabled = true;
  protected template = '';
  protected channels: NotificationChannel[] = ['IN_APP'];
  protected variables: Record<string, string> = Object.create(null);
  protected keys: string[] = [];
  private previousCampaign = { value: '', key: '' };

  ngOnInit() {
    this.code = this.text(this.row, 'code');
    this.category = this.text(this.row, 'category') || this.category;
    this.subject = this.text(this.row, 'subject');
    this.body = this.text(this.row, 'body');
    this.eventType = this.text(this.row, 'eventType');
    this.template = this.text(this.row, 'template');
    if (this.action === 'preview') this.keys = templateKeys(this.subject, this.body);
    if (this.action !== 'campaign' && this.action !== 'rule') return;
    if (this.row?.kind === 'RULE') {
      if (Array.isArray(this.row.data['recipients'])) this.recipients = this.row.data['recipients'].join(', ');
      this.enabled = this.row.data['enabled'] === true;
    }
    this.loadTemplates();
    this.api.providers().pipe(catchError(() => of([])), takeUntilDestroyed(this.destroyRef)).subscribe(providers => {
      if (providers.some(provider => provider.channel === 'EMAIL' && provider.configured && provider.recipientsAvailable))
        this.options.set(['IN_APP', 'EMAIL']);
      const existing = this.row?.data['channels'];
      if (Array.isArray(existing)) this.channels = this.options().filter(option => existing.includes(option));
    });
  }

  protected text(row: NotificationRecord | null, key: string) {
    const value = row?.data[key];
    return typeof value === 'string' ? value : '';
  }

  protected loadTemplates() {
    const page = this.templatePage();
    this.templatesBusy.set(true);
    this.api.templates(this.company, page).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.templatesBusy.set(false))).subscribe({
      next: result => {
        const codes = new Map(this.templates().map(row => [this.text(row, 'code'), row]));
        for (const row of result.items) {
          const code = this.text(row, 'code');
          const old = codes.get(code);
          if (!old || Number(row.data['version']) > Number(old.data['version'])) codes.set(code, row);
        }
        this.templates.set([...codes.values()]);
        this.moreTemplates.set(page * result.limit < result.total);
        this.templatePage.set(page + 1);
        if (this.template) this.selectTemplate(this.template);
      },
      error: error => this.error.set(apiErrorMessage(error)),
    });
  }

  protected isManual(row: NotificationRecord) {
    return !row.data['mandatory'] && manualCategories.some(category => category === row.data['category']);
  }

  protected selectTemplate(code: string) {
    this.template = code;
    const row = this.templates().find(item => this.text(item, 'code') === code);
    this.keys = templateKeys(this.text(row ?? null, 'subject'), this.text(row ?? null, 'body'));
  }

  protected toggle(channel: NotificationChannel, checked: boolean) {
    this.channels = checked ? [...this.channels, channel] : this.channels.filter(item => item !== channel);
  }

  protected submit() {
    if (this.busy()) return;
    this.error.set('');
    this.preview.set(null);
    const rowPath = this.row?.id ?? '';
    let request: Observable<unknown>;
    try {
      switch (this.action) {
        case 'draft':
          this.require(/^[A-Z0-9_]{2,80}$/.test(this.code.trim()), 'Use 2–80 uppercase letters, numbers or underscores for the code.');
          request = this.api.write(this.company, 'POST', 'templates', { code: this.code.trim(), category: this.category, ...this.content() });
          break;
        case 'edit':
          request = this.api.write(this.company, 'PATCH', 'templates/' + rowPath, this.content());
          break;
        case 'preview':
          request = this.api.preview(this.company, rowPath, this.inputVariables());
          break;
        case 'publish':
          request = this.api.write(this.company, 'POST', 'templates/' + rowPath + '/publish', {});
          break;
        case 'cancel':
          request = this.api.write(this.company, 'POST', 'campaigns/' + rowPath + '/cancel', {});
          break;
        case 'retry':
          request = this.api.write(this.company, 'POST', 'deliveries/' + rowPath + '/retry', {});
          break;
        case 'campaign':
          request = this.campaign();
          break;
        case 'rule':
          this.require(/^[A-Z0-9_]{2,80}$/.test(this.code.trim()), 'Use 2–80 uppercase letters, numbers or underscores for the code.');
          this.require(this.eventType.trim().length >= 3, 'Enter a domain event type.');
          request = this.api.write(this.company, 'PUT', 'rules', {
            ...this.audience(), code: this.code.trim(), eventType: this.eventType.trim(), enabled: this.enabled,
          });
          break;
      }
    } catch (error) {
      this.error.set(apiErrorMessage(error));
      return;
    }
    this.busy.set(true);
    this.working.emit(true);
    request.pipe(takeUntilDestroyed(this.destroyRef), finalize(() => {
      this.busy.set(false);
      this.working.emit(false);
    })).subscribe({
      next: result => {
        if (this.action === 'preview') {
          this.preview.set(result as TemplatePreview);
        } else {
          this.saved.emit(outcomes[this.action]);
        }
      },
      error: error => this.error.set(apiErrorMessage(error)),
    });
  }

  private campaign() {
    const scheduled = this.scheduled ? new Date(this.scheduled + ':00+01:00') : null;
    this.require(!scheduled || Number.isFinite(scheduled.getTime()) && scheduled.getTime() > Date.now(), 'Choose a future send time in Angola.');
    const body = { ...this.audience(), variables: this.inputVariables(), scheduledAt: scheduled?.toISOString() };
    const value = JSON.stringify(body);
    if (value !== this.previousCampaign.value) this.previousCampaign = { value, key: 'admin-campaign:' + crypto.randomUUID() };
    return this.api.write(this.company, 'POST', 'campaigns', { ...body, key: this.previousCampaign.key });
  }

  private audience() {
    const template = this.templates().find(row => this.text(row, 'code') === this.template);
    this.require(template && this.isManual(template), 'Select a published template available for administrative sends.');
    this.require(this.channels.length, 'Select at least one channel.');
    const ids = this.recipients.trim().split(/[\s,]+/);
    this.require(ids.every(id => /^\d+$/.test(id) && Number(id) > 0 && Number(id) <= 2147483647), 'Enter valid numeric user IDs separated by commas or spaces.');
    const recipients = [...new Set(ids.map(Number))];
    this.require(recipients.length <= 500, 'A send supports up to 500 recipients.');
    return { template: this.template, category: this.text(template ?? null, 'category'), recipients, channels: this.channels };
  }

  private content() {
    const subject = this.subject.trim();
    const body = this.body.trim();
    this.require(subject && body, 'Enter the subject and message text.');
    return { subject, body };
  }

  private inputVariables() {
    this.require(this.keys.every(key => this.variables[key]?.trim()), 'Enter a value for every template variable.');
    return Object.fromEntries(this.keys.map(key => [key, this.variables[key]]));
  }

  private require(condition: unknown, message: string) {
    if (!condition) throw new Error(message);
  }
}
