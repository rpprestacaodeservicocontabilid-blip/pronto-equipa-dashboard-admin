import { DatePipe, JsonPipe } from '@angular/common';
import { Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../../core/api/api-error';
import { CompanyWorkspace } from '../../../core/api/company-workspace-api';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { UUID, human, jsonConfig } from '../domain/salary-format';
import { AuditEvent, CALCULATION_METHODS, FREQUENCIES, Policy } from '../domain/salary.models';
import { can } from '../domain/salary-sections';
import { SalaryApi } from '../infrastructure/salary-api.service';
import { SalaryFormComponent } from './salary-form.component';
import { SalaryForm, effectiveFrom, string } from './salary-form';

@Component({
  selector: 'app-salary-control',
  standalone: true,
  imports: [FormsModule, DatePipe, JsonPipe, RouterLink, ComponentCardComponent, SalaryFormComponent],
  templateUrl: './salary-control.component.html',
})
export class SalaryControlComponent implements OnInit {
  @Input({ required: true }) context!: CompanyWorkspace;
  @Input({ required: true }) mode!: 'audit' | 'policies' | 'settings';
  @Input() initialResource = '';
  private readonly api = inject(SalaryApi);
  private readonly destroy = inject(DestroyRef);
  protected readonly policies = signal<Policy[] | null>(null);
  protected readonly events = signal<AuditEvent[] | null>(null);
  protected readonly cursor = signal<number | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly form = signal<SalaryForm | null>(null);
  protected readonly frequencies = FREQUENCIES;
  protected readonly methods = CALCULATION_METHODS;
  protected readonly human = human;
  protected purpose = '';
  protected action = '';
  protected resource = '';
  private appliedPurpose = '';
  private applied: { action?: string; resourceId?: string } = {};
  private throughSequence?: number;
  protected get company() { return this.context.company.id; }
  protected can(grant: string) { return can(this.context.permissions, grant); }

  ngOnInit() {
    this.resource = this.initialResource.slice(0, 150);
    if (this.mode === 'policies' && this.can('read')) this.load();
  }

  protected load() {
    this.loading.set(true);
    this.error.set('');
    this.api.policies(this.company).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: rows => { this.policies.set(rows); this.loading.set(false); },
      error: error => { this.loading.set(false); this.error.set(apiErrorMessage(error)); },
    });
  }
  protected edit(policy?: Policy) {
    this.notice.set('');
    this.form.set({
      title: 'Publish salary policy version',
      description: 'Use only rule keys supported by the company configuration.',
      fields: [
        { key: 'code', label: 'Policy code', required: true, max: 50, initial: policy?.code },
        effectiveFrom(),
        { key: 'rules', label: 'Rules (JSON object)', kind: 'textarea', required: true, max: 24000, initial: JSON.stringify(policy?.rules ?? {}, null, 2) },
      ],
      confirm: 'I confirm the effective date and the rules to publish for this company.',
      submitLabel: 'Publish policy version',
      send: values => this.api.post(this.company, 'policies', {
        code: string(values, 'code'), effectiveFrom: string(values, 'effectiveFrom'), rules: jsonConfig(string(values, 'rules')),
      }),
    });
  }
  protected published(result: unknown) {
    const policy = result as Policy;
    this.form.set(null);
    this.notice.set('Published ' + policy.code + ' · version ' + policy.version + '.');
    if (this.can('read')) this.load();
  }

  protected audit(reset: boolean) {
    if (this.loading() || !this.can('audit:records:read-tenant')) return;
    if (reset) {
      this.appliedPurpose = this.purpose.trim();
      this.applied = {
        ...(this.action.trim() ? { action: this.action.trim() } : {}),
        ...(this.resource.trim() ? { resourceId: this.resource.trim() } : {}),
      };
      this.events.set(null);
      this.cursor.set(null);
      this.throughSequence = undefined;
    }
    if (!this.appliedPurpose) return;
    this.loading.set(true);
    this.error.set('');
    this.api.audit(this.company, this.appliedPurpose, this.applied, this.cursor() ?? undefined, this.throughSequence)
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: result => {
          this.loading.set(false);
          this.events.update(rows => [...(rows ?? []), ...result.data]);
          this.cursor.set(result.nextCursor);
          this.throughSequence = result.throughSequence;
        },
        error: error => { this.loading.set(false); this.error.set(apiErrorMessage(error)); },
      });
  }
  protected batchLink(event: AuditEvent) {
    return this.can('revisions:batch') && event.action.startsWith('salary-structure.revision-batch.') &&
      !!event.resourceId && UUID.test(event.resourceId);
  }
}
