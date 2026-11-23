import { DatePipe } from '@angular/common';
import { Component, DestroyRef, Input, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { CompanyWorkspace } from '../../../../core/api/company-workspace-api';
import { apiErrorMessage } from '../../../../core/api/api-error';
import { ComponentCardComponent } from '../../../../shared/components/common/component-card/component-card.component';
import { AuditEvent } from '../../domain/organization.models';
import { OrganizationApi } from '../../infrastructure/organization-api.service';

@Component({
  selector: 'app-organization-audit',
  standalone: true,
  imports: [DatePipe, FormsModule, ComponentCardComponent],
  template: `
    <app-component-card title="Organization audit">
      @if (!allowed) { <p role="alert" class="feedback">Your company role does not allow access to audit records.</p> }
      @else {
        <div class="space-y-4">
          <form class="flex flex-wrap items-end gap-3" (ngSubmit)="load(true)">
            <label class="field flex-1">Reason for access<input class="control" name="purpose" [(ngModel)]="purpose" maxlength="2000" required [disabled]="loading()" /></label>
            <button class="action action-primary" type="submit" [disabled]="loading() || !purpose.trim()">View audit</button>
          </form>
          @if (error()) { <p role="alert" class="feedback">{{ error() }}</p> }
          @if (loading()) { <p role="status" class="text-sm text-gray-600 dark:text-gray-400">Loading audit records…</p> }
          @if (events(); as rows) {
            <div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
              <table class="w-full min-w-[36rem] text-start text-sm text-gray-700 dark:text-gray-300">
                <thead class="table-heading"><tr><th scope="col">When</th><th scope="col">Action</th><th scope="col">Actor</th><th scope="col">Resource</th><th scope="col">Outcome</th></tr></thead>
                <tbody class="divide-y divide-gray-200 dark:divide-gray-800">
                  @for (event of rows; track event.id) {
                    <tr><td class="table-cell">{{ event.occurredAt | date:'medium' }}</td><td class="table-cell">{{ event.action }}</td>
                      <td class="table-cell">{{ event.actorId || '—' }}</td><td class="table-cell">{{ event.resourceType }} · {{ event.resourceId || '—' }}</td>
                      <td class="table-cell">{{ event.outcome }}</td></tr>
                  } @empty { <tr><td class="table-cell" colspan="5">No organization audit records found.</td></tr> }
                </tbody>
              </table>
            </div>
            @if (next()) { <button class="action" type="button" [disabled]="loading()" (click)="load(false)">Load more</button> }
          }
        </div>
      }
    </app-component-card>
  `,
})
export class OrganizationAuditComponent {
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
        error: error => { this.error.set(apiErrorMessage(error)); this.loading.set(false); },
      });
  }
}
