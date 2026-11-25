import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { AuthService } from '../../../core/auth/auth.service';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { PageBreadcrumbComponent } from '../../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { label, requirementLabel, Resource, Workspace } from '../domain/onboarding.models';
import { OnboardingApi } from '../infrastructure/onboarding-api.service';

const TABS = [
  { id: 'summary', label: 'Summary' }, { id: 'company', label: 'Company and contacts' },
  { id: 'documents', label: 'Documents' }, { id: 'subscription', label: 'Plan and subscription' },
  { id: 'configuration', label: 'Setup' }, { id: 'provisioning', label: 'Provisioning' },
  { id: 'invitations', label: 'Invitations' }, { id: 'imports', label: 'Imports' },
  { id: 'history', label: 'History' },
] as const;

interface Action {
  title: string;
  path: string;
  success: string;
  approved?: boolean;
  assignee?: boolean;
  version?: number;
}

@Component({
  selector: 'app-onboarding-application',
  standalone: true,
  imports: [FormsModule, RouterLink, DatePipe, DecimalPipe, PageBreadcrumbComponent, ComponentCardComponent],
  templateUrl: './application-details.component.html',
  styleUrl: './onboarding.css',
})
export class ApplicationDetailsComponent {
  private readonly api = inject(OnboardingApi);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly query = toSignal(this.route.queryParamMap, { requireSync: true });
  private id = '';
  private request = 0;
  protected readonly workspace = signal<Workspace | null>(null);
  protected readonly busy = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly actionError = signal('');
  protected readonly notice = signal('');
  protected readonly action = signal<Action | null>(null);
  protected readonly inviteCode = signal<{ token: string; expiresAt: number } | null>(null);
  protected readonly documentLink = signal<{ url: string; fileName: string } | null>(null);
  protected readonly tabs = TABS;
  protected readonly tab = computed(() => TABS.find(item => item.id === this.query().get('tab'))?.id ?? 'summary');
  protected readonly documents = computed(() => this.workspace()?.resources.filter(row => row.kind === 'DOCUMENT') ?? []);
  protected readonly invitations = computed(() => this.workspace()?.resources.filter(row => row.kind === 'INVITATION') ?? []);
  protected readonly imports = computed(() => this.workspace()?.resources.filter(row => row.kind === 'IMPORT') ?? []);
  protected readonly timeline = computed(() => this.workspace()?.events.filter(row =>
    row.type.startsWith('onboarding.provisioning.') || ['onboarding.application.completed', 'onboarding.payment.required'].includes(row.type)) ?? []);
  protected readonly label = label;
  protected readonly requirementLabel = requirementLabel;
  protected reason = '';
  protected assignee: number | null = null;
  protected email = '';

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(params => {
      this.id = params.get('id') ?? '';
      this.workspace.set(null);
      this.closeAction();
      this.notice.set('');
      this.inviteCode.set(null);
      this.documentLink.set(null);
      void this.refresh();
    });
  }

  protected async refresh() {
    const request = ++this.request;
    this.error.set('');
    this.busy.set(true);
    try {
      const data = await firstValueFrom(this.api.workspace(this.id));
      if (request === this.request) {
        if (!this.workspace()) this.email = data.company?.email ?? '';
        this.workspace.set(data);
      }
    } catch (error) { if (request === this.request) this.error.set(apiErrorMessage(error)); }
    finally { if (request === this.request) this.busy.set(false); }
  }

  protected differentReviewer(workspace: Workspace) {
    return String(workspace.application.ownerId) !== String(this.auth.claims()?.sub);
  }

  protected stages(workspace: Workspace) {
    return [
      { title: 'Company profile', complete: !!workspace.company },
      { title: 'Terms confirmed', complete: !!workspace.termsAcceptedAt },
      { title: 'Documents validated', complete: this.documents().filter(row => row.status === 'VALIDATED').length >= workspace.requiredDocuments },
      { title: 'Plan selected', complete: !!workspace.plan },
      { title: 'Payroll configured', complete: !!workspace.payroll },
      { title: 'Review approved', complete: !!workspace.approvedBy },
      { title: 'Company activated', complete: workspace.application.status === 'COMPLETED' },
    ];
  }

  protected startAction(action: Action) {
    this.reason = '';
    this.assignee = this.workspace()?.application.assigneeId ?? null;
    this.notice.set('');
    this.actionError.set('');
    this.action.set(action);
  }

  protected closeAction() {
    this.action.set(null);
    this.actionError.set('');
  }

  protected async confirm(action: Action) {
    if (this.saving() || !this.reason.trim()) return;
    const id = this.id;
    this.saving.set(true);
    this.actionError.set('');
    const body = {
      reason: this.reason.trim(),
      ...(action.approved !== undefined ? { approved: action.approved } : {}),
      ...(action.assignee ? { assigneeId: this.assignee } : {}),
      ...(action.version !== undefined ? { version: action.version } : {}),
    };
    try {
      const result = await firstValueFrom(this.api.action(id, action.path, body));
      if (id !== this.id) return;
      this.closeAction();
      if (action.path.endsWith('/revoke')) this.inviteCode.set(null);
      const status = action.path === 'activate' || action.path === 'retry' ? result.status : undefined;
      this.notice.set(status === 'AWAITING_PAYMENT' ? 'Setup is ready. Activation awaits payment confirmation.'
        : status === 'COMPLETED' ? 'Company environment activated.' : action.success);
      await this.refresh();
    } catch (error) { if (id === this.id) this.actionError.set(apiErrorMessage(error)); }
    finally { this.saving.set(false); }
  }

  protected async createInvitation() {
    if (this.saving()) return;
    const id = this.id;
    this.saving.set(true);
    this.actionError.set('');
    this.notice.set('');
    try {
      const data = await firstValueFrom(this.api.invite(id, this.email.trim()));
      if (id !== this.id) return;
      this.inviteCode.set({ token: data.token, expiresAt: Date.now() + 1000 * data.expiresInSeconds });
      await this.refresh();
    } catch (error) { if (id === this.id) this.actionError.set(apiErrorMessage(error)); }
    finally { this.saving.set(false); }
  }

  protected async copyCode(token: string) {
    try {
      await navigator.clipboard.writeText(token);
      this.notice.set('Invitation code copied.');
    } catch { this.actionError.set('Select and copy the invitation code from the field.'); }
  }

  protected async prepareDownload(row: Resource) {
    if (this.saving()) return;
    const id = this.id;
    this.saving.set(true);
    this.actionError.set('');
    this.documentLink.set(null);
    try {
      const result = await firstValueFrom(this.api.documentUrl(id, row.id));
      if (id !== this.id) return;
      const url = new URL(result.url, window.location.origin);
      if (!['https:', 'http:'].includes(url.protocol)) throw new Error('The document link is invalid.');
      this.documentLink.set({ url: url.href, fileName: row.fileName ?? 'Verified document' });
    } catch (error) { if (id === this.id) this.actionError.set(apiErrorMessage(error)); }
    finally { this.saving.set(false); }
  }
}
