import { DatePipe, KeyValuePipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { apiErrorMessage } from '../../core/api/api-error';
import { AuthService } from '../../core/auth/auth.service';
import { ComponentCardComponent } from '../../shared/components/common/component-card/component-card.component';
import { PageBreadcrumbComponent } from '../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { downloadWorkbook } from '../../shared/utils/report-documents';
import { PlanEditorComponent } from './plan-editor.component';
import { SubscriptionsApi } from './subscriptions-api.service';
import { intervals, label, metrics, Page, Plan, PlanInput, Policy, Row, statuses } from './subscriptions.models';
import { SubscriptionSection } from './subscriptions.navigation';

type Command = 'create' | 'suspend' | 'reactivate' | 'cancel' | 'renew' | 'extend' | 'convert' | 'override' | 'approve' | 'reject' | 'archive' | 'publish';
const commandTitles: Record<Command, string> = {
  create: 'Create subscription', suspend: 'Suspend subscription', reactivate: 'Reactivate subscription', cancel: 'Cancel subscription',
  renew: 'Request renewal', extend: 'Extend trial', convert: 'Convert trial', override: 'Create exception',
  approve: 'Approve change', reject: 'Reject change', archive: 'Archive plan', publish: 'Publish version',
};
const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const recordColumns: Record<string, [string, string][]> = {
  changes: [['targetPlanVersionId', 'Target version'], ['interval', 'Interval'], ['requestedBy', 'Requested by'], ['reason', 'Reason'], ['effectiveAt', 'Effective date']],
  periods: [['startsAt', 'Starts'], ['endsAt', 'Ends'], ['kind', 'Type']],
  usage: [['metricCode', 'Metric'], ['periodKey', 'Period'], ['used', 'Used'], ['reserved', 'Reserved'], ['limit', 'Limit'], ['policy', 'Policy']],
  overrides: [['features', 'Features'], ['limits', 'Limits'], ['reason', 'Reason'], ['expiresAt', 'Expires'], ['createdBy', 'Operator']],
  history: [['fromStatus', 'Previous status'], ['toStatus', 'New status'], ['reason', 'Reason'], ['actorUserId', 'Operator'], ['at', 'Changed']],
  alerts: [['type', 'Type'], ['message', 'Message'], ['createdAt', 'Created']],
};
@Component({
  standalone: true, imports: [FormsModule, RouterLink, DatePipe, KeyValuePipe, PageBreadcrumbComponent, ComponentCardComponent, PlanEditorComponent],
  templateUrl: './subscriptions-workspace.component.html', styleUrl: './subscriptions.css',
})
export class SubscriptionsWorkspaceComponent {
  private readonly api = inject(SubscriptionsApi);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  protected readonly section = this.route.snapshot.data['section'] as SubscriptionSection;
  protected readonly columns = recordColumns[this.section.resource ?? ''] ?? [];
  protected readonly label = label;
  protected readonly statuses = statuses;
  protected readonly intervals = intervals;
  protected readonly metrics = metrics;
  protected readonly titles = commandTitles;
  protected readonly rows = signal<Row[]>([]);
  protected readonly planList = signal<Plan[]>([]);
  protected readonly featureList = signal<Row[]>([]);
  protected readonly selectedPlan = signal<Plan | null>(null);
  protected readonly selected = signal<Row | null>(null);
  protected readonly editor = signal<{ plan: Plan | null } | null>(null);
  protected readonly command = signal<{ type: Command; id: string } | null>(null);
  protected readonly report = signal<Record<string, number> | null>(null);
  protected readonly policy = signal<Policy | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly resultPage = signal<Page | null>(null);
  protected companyId: number | null = null;
  protected companyFilter: number | null = null;
  protected subscriptionId = '';
  protected status = '';
  protected feature = { code: '', name: '', description: '' };
  protected showFeature = false;
  protected form = { reason: '', days: 7, versionId: '', interval: 'MONTHLY', atPeriodEnd: true, metric: '', limit: '',
    feature: '', enabled: true, expires: '' };
  private revision = 0;
  private creation = { fingerprint: '', key: '' };

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => {
      const company = Number(params.get('companyId'));
      this.companyId = this.validCompany(company) ? company : null;
      this.companyFilter = this.companyId;
      const id = params.get('subscriptionId') ?? '';
      this.subscriptionId = uuid.test(id) ? id : '';
      this.command.set(null);
      this.selected.set(null);
      void this.load();
    });
  }
  private validCompany(value: number | null): value is number {
    return value !== null && Number.isInteger(value) && value >= 1 && value <= 2147483647;
  }
  protected scope() {
    if (this.companyFilter !== null && !this.validCompany(this.companyFilter)) { this.error.set('Enter a valid company ID.'); return; }
    if (this.companyFilter === this.companyId && !this.subscriptionId) { void this.load(); return; }
    void this.router.navigate([], { relativeTo: this.route, queryParams: { companyId: this.companyFilter } });
  }
  protected choose(row: Row) {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { companyId: row.companyId, subscriptionId: row.id } });
  }
  private read<T>(path: string, params?: Record<string, string | number>) {
    return firstValueFrom(this.api.get<T>(path, params).pipe(takeUntilDestroyed(this.destroy)));
  }
  protected async load(page = 1) {
    const revision = ++this.revision;
    this.loading.set(true); this.error.set(''); this.resultPage.set(null); this.rows.set([]);
    try {
      if (this.section.view === 'report') this.report.set(await this.read('reports'));
      else if (this.section.view === 'policy') this.policy.set({ trialDays: 14, graceDays: 7, renewalNoticeDays: 30,
        allowOverage: false, trialEligibleOnce: true, ...await this.read<Partial<Policy>>('policies') });
      else if (this.section.view === 'features') this.featureList.set(await this.read('features'));
      else if (this.section.view === 'plans') {
        const [plans, features] = await Promise.all([this.read<Plan[]>('plans'), this.read<Row[]>('features')]);
        this.planList.set(plans); this.featureList.set(features);
        const id = this.selectedPlan()?.id;
        this.selectedPlan.set(plans.find(plan => plan.id === id) ?? null);
      } else {
        const params: Record<string, string | number> = { limit: 100 };
        if (this.companyId) params['companyId'] = this.companyId;
        if (this.section.view === 'subscriptions' && (this.section.status || this.status)) params['status'] = this.section.status || this.status;
        const rows = await this.read<Row[]>('subscriptions', params);
        if (revision !== this.revision) return;
        this.rows.set(rows);
        if (this.companyId && this.subscriptionId) {
          const path = 'tenants/' + this.companyId + '/';
          const detail = await this.read<Row | null>(path + 'subscription', { subscriptionId: this.subscriptionId });
          if (revision !== this.revision) return;
          this.selected.set(detail);
          if (!detail) { this.error.set('Subscription not found for this company.'); return; }
          if (this.section.resource) {
            const result = await this.read<Page>(path + 'records/' + this.section.resource + '/' + this.subscriptionId, { page, limit: 25 });
            if (revision === this.revision) this.resultPage.set(result);
          }
        }
      }
    } catch (error) { if (revision === this.revision) this.error.set(apiErrorMessage(error)); }
    finally { if (revision === this.revision) this.loading.set(false); }
  }
  protected display(value: unknown): string {
    if (value === null) return 'Unlimited';
    if (value === undefined || value === '') return '—';
    if (typeof value === 'object') return Object.entries(value).map(([key, item]) =>
      label(key) + ' · ' + this.display(item)).join(', ') || '—';
    return typeof value === 'boolean' ? value ? 'Enabled' : 'Disabled' : String(value);
  }

  protected async start(type: Command, id: string) {
    this.notice.set(''); this.error.set('');
    this.form = { reason: '', days: 7, versionId: '', interval: 'MONTHLY', atPeriodEnd: true, metric: '', limit: '',
      feature: '', enabled: true, expires: '' };
    this.command.set({ type, id });
    try {
      if (type === 'convert' || type === 'create') this.planList.set(await this.read('plans'));
      if (type === 'override') this.featureList.set(await this.read('features'));
    } catch (error) { this.error.set(apiErrorMessage(error)); }
  }
  protected canApprove(row: Row) { return String(row['requestedBy']) !== this.auth.claims()?.sub; }
  protected canReactivate(row: Row) {
    return row.status === 'SUSPENDED' && row['suspendedFrom'] === 'ACTIVE' && Date.parse(String(row['currentPeriodEnd'])) > Date.now();
  }
  protected companyCommands(row: Row): Command[] {
    switch (row.status) {
      case 'ACTIVE': return ['renew', 'suspend', 'override', 'cancel'];
      case 'GRACE_PERIOD': return ['renew', 'cancel'];
      case 'TRIALING': return ['extend', 'convert', 'override', 'cancel'];
      case 'PENDING_PAYMENT': return ['cancel'];
      case 'SUSPENDED': return this.canReactivate(row) ? ['reactivate', 'cancel'] : ['cancel'];
      default: return [];
    }
  }
  protected async submit() {
    const cmd = this.command();
    if (!cmd) return;
    const f = this.form;
    const reason = f.reason.trim();
    if (['suspend', 'reactivate', 'cancel', 'extend', 'override', 'approve', 'reject'].includes(cmd.type) && reason.length < 3) {
      this.error.set('Enter a reason with at least three characters.'); return;
    }
    if (cmd.type === 'publish') return this.save('plans/' + this.selectedPlan()?.id + '/publish', { versionId: cmd.id }, 'Version published.');
    if (cmd.type === 'archive') return this.save('plans/' + cmd.id + '/archive', {}, 'Plan archived.');
    if (cmd.type === 'create' && this.companyId) {
      const path = 'tenants/' + this.companyId + '/subscriptions';
      const data = { planVersionId: f.versionId, interval: f.interval };
      const fingerprint = path + JSON.stringify(data);
      if (this.creation.fingerprint !== fingerprint) this.creation = { fingerprint, key: crypto.randomUUID() };
      return this.save(path, { ...data, idempotencyKey: this.creation.key }, 'Subscription created. Check its commercial status.');
    }
    if (!this.companyId || !this.subscriptionId) return;
    const tenant = 'tenants/' + this.companyId + '/';
    const sub = tenant + 'subscriptions/' + this.subscriptionId + '/';
    switch (cmd.type) {
      case 'suspend':
      case 'reactivate': return this.save(tenant + cmd.type, { reason, subscriptionId: this.subscriptionId }, 'Access status updated.');
      case 'cancel': return this.save(sub + 'cancel', { reason, atPeriodEnd: f.atPeriodEnd }, f.atPeriodEnd ? 'Cancellation scheduled.' : 'Subscription cancelled.');
      case 'renew': return this.save(sub + 'renew', {}, 'Renewal requested.');
      case 'extend': return this.save(tenant + 'trials/extend', { reason, days: f.days, subscriptionId: this.subscriptionId }, 'Trial extended.');
      case 'convert': return this.save(sub + 'convert', { planVersionId: f.versionId, interval: f.interval }, 'Conversion request processed. Check the subscription status.');
      case 'override': {
        if (!f.feature && !f.metric) { this.error.set('Select a feature or a quota.'); return; }
        const expiresAt = f.expires ? new Date(f.expires) : null;
        if (expiresAt && !(expiresAt.getTime() > Date.now())) { this.error.set('Select a future expiration date.'); return; }
        return this.save(tenant + 'overrides', { reason, subscriptionId: this.subscriptionId,
          ...(f.feature ? { features: { [f.feature]: f.enabled } } : {}),
          ...(f.metric ? { limits: { [f.metric]: f.limit || null } } : {}),
          ...(expiresAt ? { expiresAt: expiresAt.toISOString() } : {}),
        }, 'Commercial exception created.');
      }
      case 'approve':
      case 'reject': return this.save(tenant + 'change-requests/' + cmd.id + '/' + cmd.type, { reason }, 'Decision recorded.');
    }
  }
  protected savePlan(input: PlanInput) {
    const plan = this.editor()?.plan;
    return this.save(plan ? 'plans/' + plan.id + '/versions' : 'plans', input, plan ? 'Version draft created.' : 'Plan draft created.');
  }
  protected addFeature() { return this.save('features', this.feature, 'Feature added to the catalogue.'); }
  protected savePolicy(policy: Policy) {
    const { trialDays, graceDays, renewalNoticeDays, trialEligibleOnce } = policy;
    return this.save('policies', { trialDays, graceDays, renewalNoticeDays, trialEligibleOnce }, 'Policy saved.', 'PUT');
  }
  protected exportReport(data: Record<string, number>) {
    downloadWorkbook('prontoequipas-subscriptions', { title: 'Commercial subscription report', company: 'All companies',
      headings: ['Metric', 'Total'], rows: Object.entries(data).map(([key, count]) => [this.reportLabel(key), count]) });
  }
  protected reportLabel(key: string) { return label(key.replace(/([a-z])([A-Z])/g, '$1_$2')); }
  private async save(path: string, body: object, message: string, method: 'POST' | 'PUT' = 'POST') {
    if (this.saving()) return;
    const revision = this.revision;
    this.error.set(''); this.notice.set(''); this.saving.set(true);
    try {
      await firstValueFrom(this.api.save(path, body, method).pipe(takeUntilDestroyed(this.destroy)));
      if (revision !== this.revision) return;
      this.command.set(null); this.editor.set(null); this.showFeature = false;
      this.notice.set(message);
      await this.load();
    } catch (error) { if (revision === this.revision) this.error.set(apiErrorMessage(error)); }
    finally { this.saving.set(false); }
  }
}
