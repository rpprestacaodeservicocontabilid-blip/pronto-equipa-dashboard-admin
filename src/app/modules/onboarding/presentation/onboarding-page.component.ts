import { DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { PageBreadcrumbComponent } from '../../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { downloadWorkbook, printReport, ReportDocument } from '../../../shared/utils/report-documents';
import { Application, APPLICATION_STATUSES, Count, label, MODES, OnboardingEvent, OnboardingMode, Overview,
  PolicyResponse, RequirementMode, Resource } from '../domain/onboarding.models';
import { OnboardingSection } from '../domain/onboarding.navigation';
import { OnboardingApi } from '../infrastructure/onboarding-api.service';

const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const RESOURCE_STATUSES = {
  DOCUMENT: ['UPLOADING', 'CLEAN', 'VALIDATED', 'REJECTED', 'QUARANTINED'],
  INVITATION: ['PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED'],
  IMPORT: ['QUEUED', 'COMPLETED', 'PARTIALLY_COMPLETED'],
};

@Component({
  selector: 'app-onboarding-page',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe, DecimalPipe, PercentPipe, PageBreadcrumbComponent, ComponentCardComponent],
  templateUrl: './onboarding-page.component.html',
  styleUrl: './onboarding.css',
})
export class OnboardingPageComponent {
  private readonly api = inject(OnboardingApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly section = this.route.snapshot.data['section'] as OnboardingSection;
  protected readonly overview = signal<Overview | null>(null);
  protected readonly applications = signal<Application[]>([]);
  protected readonly resources = signal<Resource[]>([]);
  protected readonly events = signal<OnboardingEvent[]>([]);
  protected readonly policy = signal<PolicyResponse | null>(null);
  protected readonly busy = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly actionError = signal('');
  protected readonly notice = signal('');
  protected readonly showCreate = signal(false);
  protected readonly label = label;
  protected readonly modes = MODES;
  protected readonly assistedModes = MODES.filter(mode => mode !== 'SELF_SERVICE');
  protected readonly statuses = this.section.resource ? RESOURCE_STATUSES[this.section.resource] : APPLICATION_STATUSES;
  protected readonly filters = { search: '', status: '', mode: '', owner: '', assignee: '', from: '', to: '', applicationId: '' };
  protected readonly draft = { name: '', taxId: '', email: '', phone: '', address: '', mode: 'ADMIN_ASSISTED', source: '' };
  protected policyInput = {
    requiredDocuments: 0, invitationHours: 24, inactivityDays: 7, reason: '',
    companyVerificationModes: [] as OnboardingMode[], organizationRequiredModes: [] as OnboardingMode[],
  };
  protected grouping: 'daily' | 'weekly' | 'monthly' = 'daily';
  protected page = 1;
  protected total = 0;
  protected readonly limit = 20;
  private sequence = 0;
  private draftRequest?: { content: string; key: string };

  constructor() {
    const status = this.route.snapshot.queryParamMap.get('status');
    if (this.statuses.some(item => item === status)) this.filters.status = status!;
    void this.refresh();
  }

  protected changePage(page: number) {
    this.page = page;
    void this.refresh();
  }

  protected async refresh() {
    const sequence = ++this.sequence;
    this.error.set('');
    if (this.filters.from && this.filters.to && this.filters.from > this.filters.to) {
      this.error.set('The end date must be on or after the start date.');
      this.busy.set(false);
      return;
    }
    if (this.filters.applicationId && !uuid.test(this.filters.applicationId.trim())) {
      this.error.set('Enter a valid application reference.');
      this.busy.set(false);
      return;
    }
    this.busy.set(true);
    const f = this.filters;
    const pagination = { page: this.page, limit: this.limit };
    try {
      switch (this.section.kind) {
        case 'overview':
        case 'reports': {
          const data = await firstValueFrom(this.api.overview({ from: f.from, to: f.to }));
          if (sequence === this.sequence) this.overview.set(data);
          break;
        }
        case 'applications': {
          const data = await firstValueFrom(this.api.applications({
            ...pagination, search: f.search.trim(), status: this.section.statuses || f.status,
            mode: f.mode, owner: f.owner, assignee: f.assignee, from: f.from, to: f.to, flag: this.section.flag,
          }));
          if (sequence === this.sequence) { this.applications.set(data.items); this.total = data.total; }
          break;
        }
        case 'resources': {
          const data = await firstValueFrom(this.api.resources(this.section.resource!, {
            ...pagination, status: this.section.statuses || f.status, importKind: this.section.importKind,
          }));
          if (sequence === this.sequence) { this.resources.set(data.items); this.total = data.total; }
          break;
        }
        case 'events': {
          const data = await firstValueFrom(this.api.events(this.section.path === 'communications', {
            ...pagination, applicationId: f.applicationId.trim(),
          }));
          if (sequence === this.sequence) { this.events.set(data.items); this.total = data.total; }
          break;
        }
        case 'settings': {
          const data = await firstValueFrom(this.api.policy());
          if (sequence !== this.sequence) return;
          this.policy.set(data);
          this.policyInput = {
            ...data.current, reason: '',
            companyVerificationModes: data.current.companyVerificationModes ?? [],
            organizationRequiredModes: data.current.organizationRequiredModes ?? [],
          };
        }
      }
    } catch (error) {
      if (sequence === this.sequence) this.error.set(apiErrorMessage(error));
    } finally {
      if (sequence === this.sequence) this.busy.set(false);
    }
  }

  protected startCreate() {
    this.actionError.set('');
    this.showCreate.set(!this.showCreate());
  }

  protected async create() {
    if (this.saving()) return;
    const { mode, source, name, taxId, email, phone, address } = this.draft;
    if (name.trim().length < 2 || taxId.trim().length < 5 || !source.trim() || !address.trim()) {
      this.actionError.set('Enter the company name, tax ID, address and source.');
      return;
    }
    const input = { mode, source: source.trim(), company: {
      name: name.trim(), taxId: taxId.trim(), email: email.trim(), address: address.trim(),
      ...(phone.trim() ? { phone: phone.trim() } : {}),
    } };
    const content = JSON.stringify(input);
    if (this.draftRequest?.content !== content) this.draftRequest = { content, key: crypto.randomUUID() };
    this.actionError.set('');
    this.saving.set(true);
    try {
      const result = await firstValueFrom(this.api.create({ ...input, operationKey: this.draftRequest.key }));
      await this.router.navigate(['/onboarding/applications', result.id], { queryParams: { tab: 'invitations' } });
    } catch (error) { this.actionError.set(apiErrorMessage(error)); }
    finally { this.saving.set(false); }
  }

  protected async publish(policy: PolicyResponse) {
    const { requiredDocuments, invitationHours, inactivityDays, companyVerificationModes, organizationRequiredModes, reason } = this.policyInput;
    if (this.saving() || !reason.trim()) return;
    this.saving.set(true);
    this.actionError.set('');
    this.notice.set('');
    try {
      const version = await firstValueFrom(this.api.publish({
        requiredDocuments, invitationHours, inactivityDays, companyVerificationModes, organizationRequiredModes,
      }, policy.current.version, reason.trim()));
      this.notice.set('Policy version ' + version.version + ' published.');
      await this.refresh();
    } catch (error) { this.actionError.set(apiErrorMessage(error)); }
    finally { this.saving.set(false); }
  }

  protected setRequirement(key: RequirementMode, mode: OnboardingMode, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    const selected = this.policyInput[key].filter(item => item !== mode);
    this.policyInput[key] = checked ? [...selected, mode] : selected;
  }

  protected applicationTab() {
    if (this.section.tab) return this.section.tab;
    if (this.section.group === 'Provisioning') return 'provisioning';
    if (this.section.group === 'Company verification') return 'company';
    return 'summary';
  }

  protected resourceTab(row: Resource) {
    return row.kind === 'DOCUMENT' ? 'documents' : row.kind === 'INVITATION' ? 'invitations' : 'imports';
  }

  protected share(status: Count, total: number) {
    return total > 0 ? status.count / total : 0;
  }

  protected intake(data: Overview) {
    if (this.grouping === 'daily') return data.daily;
    const periods = new Map<string, number>();
    for (const item of data.daily) {
      let start = item.label.slice(0, 7);
      if (this.grouping === 'weekly') {
        const date = new Date(item.label + 'T00:00:00Z');
        date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
        start = date.toISOString().slice(0, 10);
      }
      periods.set(start, (periods.get(start) ?? 0) + item.count);
    }
    return Array.from(periods, ([label, count]) => ({ label, count }));
  }

  protected exportReport(data: Overview, printable: boolean) {
    const report: ReportDocument = {
      title: 'Onboarding activity', company: 'PRONTOEQUIPAS',
      headings: ['Area', 'Item', 'Count', 'Completed'],
      rows: [
        ['Summary', 'All applications', data.total, data.completed],
        ['Summary', 'Cancelled applications', data.cancelled],
        ['Summary', 'Failed provisionings', data.failed],
        ['Summary', 'Import batches', data.importBatches],
        ['Summary', 'Average days to completion', data.meanDays === null ? null : Math.round(data.meanDays * 10) / 10],
        ...this.intake(data).map(item => [label(this.grouping) + ' intake', item.label, item.count]),
        ...data.status.map(item => ['Status', label(item.label), item.count]),
        ...data.modes.map(item => ['Mode', label(item.label), item.count]),
        ...data.assignees.map(item => ['Assignee', 'Account #' + item.label, item.count]),
        ...data.plans.map(item => ['Plan version', item.label, item.total, item.completed]),
      ],
    };
    if (printable) printReport(report, value => value);
    else downloadWorkbook('onboarding-activity', report);
  }
}
