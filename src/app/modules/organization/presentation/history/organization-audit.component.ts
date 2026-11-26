import { DatePipe } from '@angular/common';
import { Component, DestroyRef, Input, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { CompanyWorkspace } from '../../../../core/api/company-workspace-api';
import { organizationErrorMessage, organizationOptionLabel } from '../organization-display';
import { organizationAuditAction, organizationAuditResource } from '../organization-api-labels';
import { ComponentCardComponent } from '../../../../shared/components/common/component-card/component-card.component';
import { AuditEvent } from '../../domain/organization.models';
import { OrganizationApi } from '../../infrastructure/organization-api.service';

@Component({
  selector: 'app-organization-audit',
  standalone: true,
  imports: [DatePipe, FormsModule, ComponentCardComponent],
  template: `
    <app-component-card i18n-title="@@organization-organization-audit" title="Organization audit">
      @if (!allowed) { <p role="alert" class="feedback"><ng-container i18n="@@organization-your-company-role-does-not-allow-access-to-audit-records">Your company role does not allow access to audit records.</ng-container></p> }
      @else {
        <div class="space-y-4">
          <form class="flex flex-wrap items-end gap-3" (ngSubmit)="load(true)">
            <label class="field flex-1"><ng-container i18n="@@organization-reason-for-access">Reason for access</ng-container><input class="control" name="purpose" [(ngModel)]="purpose" maxlength="2000" required [disabled]="loading()" /></label>
            <button class="action action-primary" type="submit" [disabled]="loading() || !purpose.trim()"><ng-container i18n="@@organization-view-audit">View audit</ng-container></button>
          </form>
          @if (error()) { <p role="alert" class="feedback">{{ error() }}</p> }
          @if (loading()) { <p role="status" class="text-sm text-gray-600 dark:text-gray-400"><ng-container i18n="@@organization-loading-audit-records">Loading audit records…</ng-container></p> }
          @if (events(); as rows) {
            <div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
              <table class="w-full min-w-[36rem] text-start text-sm text-gray-700 dark:text-gray-300">
                <thead class="table-heading"><tr><th scope="col"><ng-container i18n="@@organization-when">When</ng-container></th><th scope="col"><ng-container i18n="@@organization-action">Action</ng-container></th><th scope="col"><ng-container i18n="@@organization-actor">Actor</ng-container></th><th scope="col"><ng-container i18n="@@organization-resource">Resource</ng-container></th><th scope="col"><ng-container i18n="@@organization-outcome">Outcome</ng-container></th></tr></thead>
                <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
                  @for (event of rows; track event.id) {
                    <tr><td class="table-cell">{{ event.occurredAt | date:'medium' }}</td><td class="table-cell" [title]="event.action">{{ auditAction(event.action) }}</td>
                      <td class="table-cell">{{ event.actorId || '—' }}</td><td class="table-cell" [title]="event.resourceType">{{ auditResource(event.resourceType) }} · {{ event.resourceId || '—' }}</td>
                      <td class="table-cell">{{ optionLabel(event.outcome) }}</td></tr>
                  } @empty { <tr><td class="table-cell" colspan="5"><ng-container i18n="@@organization-no-organization-audit-records-found">No organization audit records found.</ng-container></td></tr> }
                </tbody>
              </table>
            </div>
            @if (next()) { <button class="action" type="button" [disabled]="loading()" (click)="load(false)"><ng-container i18n="@@organization-load-more">Load more</ng-container></button> }
          }
        </div>
      }
    </app-component-card>
  `,
})
export class OrganizationAuditComponent {
  protected readonly optionLabel = organizationOptionLabel;
  protected readonly auditAction = organizationAuditAction;
  protected readonly auditResource = organizationAuditResource;
  @Input({ required: true }) context!: CompanyWorkspace;
  private readonly api = inject(OrganizationApi);
  private readonly destroy = inject(DestroyRef);
  protected readonly events = signal<AuditEvent[] | null>(null);
  protected readonly next = signal<number | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected purpose = '';
  private appliedPurpose = '';
  private through?: number;

  protected get allowed() { return this.context.permissions.includes('audit:records:read-tenant'); }

  protected load(reset: boolean) {
    if (!this.allowed || this.loading()) return;
    if (reset) {
      this.appliedPurpose = this.purpose.trim();
      this.through = undefined;
      this.next.set(null);
      this.events.set(null);
    }
    if (!this.appliedPurpose) return;
    this.loading.set(true);
    this.error.set('');
    this.api.audit(this.context.company.id, this.appliedPurpose, this.next() ?? undefined, this.through)
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: result => {
          this.events.update(events => [...(events ?? []), ...result.data]);
          this.next.set(result.nextCursor);
          this.through = result.throughSequence;
          this.loading.set(false);
        },
        error: error => { this.error.set(organizationErrorMessage(error)); this.loading.set(false); },
      });
  }
}
