import { Component, computed, DestroyRef, inject, linkedSignal, signal, ViewEncapsulation } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, of, throwError } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { AuthService } from '../../../core/auth/auth.service';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { PageBreadcrumbComponent } from '../../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { isPayrollId } from '../../payroll/domain/payroll-format';
import { payrollQuery } from '../../payroll/presentation/payroll-ui';
import { LegalDraft } from '../domain/legal-draft';
import { effectiveState, legalScope, todayInAngola } from '../domain/legal-format';
import { LEGAL_SECTIONS, LegalCategory } from '../domain/legal-navigation';
import { LegalAction, LegalGrant, LegalStatus, LegalVersion } from '../domain/legal.models';
import { LegalRulesApi } from '../infrastructure/legal-rules-api.service';
import { LegalDefinitionComponent } from './legal-definition.component';

const actions: { id: LegalAction; label: string; permission: LegalGrant; status: LegalStatus; reason?: boolean; confirmation: string }[] = [
  { id: 'submit', label: 'Submit for review', permission: 'submit', status: 'DRAFT',
    confirmation: 'Submitting freezes this version and sends it for review.' },
  { id: 'approve', label: 'Approve', permission: 'approve', status: 'IN_REVIEW',
    confirmation: 'Confirm that the official references, effective dates and parameters have been reviewed.' },
  { id: 'reject', label: 'Reject', permission: 'approve', status: 'IN_REVIEW', reason: true,
    confirmation: 'Record why the version was rejected. Corrections can be drafted in a new version.' },
  { id: 'publish', label: 'Publish', permission: 'publish', status: 'APPROVED',
    confirmation: 'Publishing makes this version available to payroll for its effective dates.' },
  { id: 'retire', label: 'Retire', permission: 'retire', status: 'PUBLISHED',
    confirmation: 'Retiring removes this version from future payroll resolution and preserves its history.' },
];
type Action = typeof actions[number];

@Component({
  selector: 'app-legal-version', standalone: true,
  imports: [RouterLink, FormsModule, ComponentCardComponent, PageBreadcrumbComponent, LegalDefinitionComponent],
  styleUrl: '../../../shared/components/common/company-workspace/workspace.css', encapsulation: ViewEncapsulation.None,
  templateUrl: './legal-version.component.html',
})
export class LegalVersionComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(LegalRulesApi);
  private readonly auth = inject(AuthService);
  private readonly destroy = inject(DestroyRef);
  private readonly params = toSignal(this.route.paramMap, { requireSync: true });
  private readonly query = toSignal(this.route.queryParamMap, { requireSync: true });
  private readonly id = computed(() => this.params().get('id'));
  private readonly sourceVersion = computed(() => this.id() || this.query().get('copy'));
  private readonly refreshCount = signal(0);
  private readonly saved = signal<LegalVersion | null>(null);
  protected readonly creating = computed(() => !this.id());
  protected readonly editing = linkedSignal(() => this.creating());
  protected readonly loading = payrollQuery(computed(() => ({ id: this.sourceVersion(), refresh: this.refreshCount() })),
    ({ id }) => !id ? of(null) : isPayrollId(id) ? this.api.version(id) : throwError(() => new Error('Invalid rule set identifier.')));
  protected readonly catalog = payrollQuery(signal(0), () => this.api.sources());
  protected readonly record = computed(() => {
    const id = this.id();
    const saved = this.saved();
    const remote = this.loading();
    return id && saved?.id === id ? saved : id && remote && 'data' in remote && remote.data?.id === id ? remote.data : null;
  });
  protected readonly draft = linkedSignal(() => {
    const result = this.loading();
    const source = this.creating() && result && 'data' in result ? result.data : this.record();
    return new LegalDraft(source ?? undefined, this.creating() && !!source);
  });
  protected readonly tabs: { id: 'general' | LegalCategory; title: string }[] = [
    { id: 'general', title: 'General' },
    ...LEGAL_SECTIONS.filter(section => section.view === 'category').map(section => ({ id: section.path, title: section.title })),
  ];
  protected readonly tab = linkedSignal<'general' | LegalCategory>(() =>
    this.tabs.find(item => item.id === this.query().get('section'))?.id ?? 'general');
  protected readonly activeTitle = computed(() => this.tabs.find(item => item.id === this.tab())?.title ?? 'General');
  protected readonly working = signal(false);
  protected readonly message = signal('');
  protected readonly error = signal('');
  protected readonly pending = signal<Action | null>(null);
  protected reason = '';
  protected readonly scope = legalScope;
  private readonly today = todayInAngola();
  protected readonly availableActions = computed(() => {
    const current = this.record();
    if (!current || this.editing()) return [];
    return actions.filter(action => action.status === current.status && this.can(action.permission) &&
      (!['approve', 'reject'].includes(action.id) || !this.ownSubmission(current)));
  });
  protected can(grant: LegalGrant) { return !!this.auth.claims()?.permissions.includes('legal-rules:' + grant); }
  protected state(record: LegalVersion) { return effectiveState(record, this.today); }
  protected ownSubmission(record: LegalVersion) {
    const user = this.auth.claims()?.sub;
    return user === String(record.createdBy) || user === String(record.submittedBy);
  }
  protected refresh() {
    this.saved.set(null);
    this.editing.set(this.creating());
    this.pending.set(null);
    this.refreshCount.update(value => value + 1);
  }
  protected beginEdit() { this.error.set(''); this.message.set(''); this.pending.set(null); this.editing.set(true); }
  protected cancelEdit() {
    this.editing.set(false);
    this.error.set('');
    this.draft.set(new LegalDraft(this.record() ?? undefined));
  }
  protected toggleSource(id: string, checked: boolean) {
    const ids = this.draft().sourceIds;
    if (checked && !ids.includes(id) && ids.length < 30) ids.push(id);
    else if (!checked && ids.includes(id)) ids.splice(ids.indexOf(id), 1);
  }
  protected confirm(action: Action) {
    this.pending.set(action);
    this.reason = '';
    this.error.set('');
    this.message.set('');
  }

  protected save() {
    if (this.working() || !this.editing() || !this.can(this.creating() ? 'create' : 'update')) return;
    const current = this.record();
    if (!this.creating() && current?.status !== 'DRAFT') return;
    this.error.set('');
    this.message.set('');
    let input;
    try { input = this.draft().toInput(); }
    catch (error) { this.error.set(error instanceof Error ? error.message : 'Check the draft fields.'); return; }
    this.working.set(true);
    const request = current ? this.api.update(current.id, {
      effectiveFrom: input.effectiveFrom, effectiveTo: input.effectiveTo, sourceReference: input.sourceReference,
      evidenceReference: input.evidenceReference, rules: input.rules, governance: input.governance, expectedUpdatedAt: current.updatedAt,
    }) : this.api.create(input);
    request.pipe(takeUntilDestroyed(this.destroy), finalize(() => this.working.set(false))).subscribe({
      next: record => {
        this.saved.set(record);
        this.editing.set(false);
        this.message.set('Draft saved.');
        if (!current) void this.router.navigate(['/legal-rules/rule-sets', record.id]);
      },
      error: error => this.error.set(apiErrorMessage(error)),
    });
  }

  protected transition() {
    const action = this.pending();
    const current = this.record();
    const reason = this.reason.trim();
    if (!action || !current || this.working() || !this.availableActions().includes(action) || (action.reason && !reason)) return;
    this.error.set('');
    this.working.set(true);
    this.api.transition(current.id, action.id, current.updatedAt, action.reason ? reason : undefined).pipe(
      takeUntilDestroyed(this.destroy), finalize(() => this.working.set(false)),
    ).subscribe({
      next: record => {
        this.saved.set(record);
        this.pending.set(null);
        this.message.set('Version updated to ' + this.state(record).toLowerCase() + '.');
      },
      error: error => this.error.set(apiErrorMessage(error)),
    });
  }
}
