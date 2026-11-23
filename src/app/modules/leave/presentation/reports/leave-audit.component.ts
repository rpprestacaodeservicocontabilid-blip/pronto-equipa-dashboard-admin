import { DatePipe } from '@angular/common';
import { Component, DestroyRef, Input, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { CompanyWorkspace } from '../../../../core/api/company-workspace-api';
import { apiErrorMessage } from '../../../../core/api/api-error';
import { ComponentCardComponent } from '../../../../shared/components/common/component-card/component-card.component';
import { LeaveAuditEvent } from '../../domain/leave.models';
import { validRange } from '../../domain/leave-rules';
import { LeaveApi } from '../../infrastructure/leave-api.service';

@Component({
  selector: 'app-leave-audit',
  standalone: true,
  imports: [DatePipe, FormsModule, ComponentCardComponent],
  template: `
    <app-component-card title="Leave audit">
      <form class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" (ngSubmit)="load(true)">
        <label class="field">Reason for access<input class="control" name="purpose" [(ngModel)]="purpose" maxlength="2000" required /></label>
        <label class="field">Actor account<input class="control" name="actor" [(ngModel)]="actor" maxlength="200" /></label>
        <label class="field">Action code<input class="control" name="action" [(ngModel)]="action" maxlength="200" placeholder="Exact action code" /></label>
        <label class="field">From<input class="control" type="date" name="from" [(ngModel)]="from" /></label>
        <label class="field">To<input class="control" type="date" name="to" [(ngModel)]="to" [attr.min]="from || null" /></label>
        <button class="action action-primary self-end" type="submit" [disabled]="loading() || !purpose.trim()">View audit</button>
      </form>
      @if (requestId()) {
        <p class="break-all text-sm text-gray-600 dark:text-gray-400">Filtered to request {{ requestId() }}
          <button type="button" class="action ms-2" (click)="requestId.set(''); rows.set(null); next.set(null)" [disabled]="loading()">Clear request filter</button>
        </p>
      }
      @if (error()) { <p role="alert" class="feedback">{{ error() }}</p> }
      @if (loading()) { <p role="status" class="text-sm text-gray-600 dark:text-gray-400">Loading audit records…</p> }
      @if (rows(); as entries) {
        <ul class="divide-y divide-gray-200 dark:divide-gray-800">
          @for (event of entries; track event.id) {
            <li class="py-2 text-sm text-gray-700 dark:text-gray-300">
              <p><strong>{{ event.action }}</strong> · {{ event.occurredAt | date:'medium' }} · {{ event.outcome }}</p>
              <p class="break-all">Actor {{ event.actorId || '—' }} · Record {{ event.resourceId }}</p>
            </li>
          } @empty { <li class="text-sm text-gray-600 dark:text-gray-400">No matching audit records.</li> }
        </ul>
        @if (next() !== null) { <button class="action" type="button" (click)="load(false)" [disabled]="loading()">Load more</button> }
      }
    </app-component-card>
  `,
})
export class LeaveAuditComponent {
  @Input({ required: true }) context!: CompanyWorkspace;
  private readonly api = inject(LeaveApi);
  private readonly destroy = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  protected readonly requestId = signal(this.route.snapshot.queryParamMap.get('request') ?? '');
  protected readonly rows = signal<LeaveAuditEvent[] | null>(null);
  protected readonly next = signal<number | null>(null);
  protected readonly error = signal('');
  protected readonly loading = signal(false);
  protected purpose = '';
  protected actor = '';
  protected action = '';
  protected from = '';
  protected to = '';
  private applied = { purpose: '', actorId: '', action: '', startDate: '', endDate: '', resourceId: '' };
  private through?: number;

  protected load(reset: boolean) {
    if (this.loading() || !this.context.permissions.includes('audit:records:read-tenant')) return;
    this.error.set('');
    if (reset) {
      if (!this.purpose.trim() || (this.from && this.to && !validRange(this.from, this.to))) {
        this.error.set('Provide a reason and valid dates.');
        return;
      }
      this.applied = { purpose: this.purpose.trim(), actorId: this.actor.trim(), action: this.action.trim(),
        startDate: this.from, endDate: this.to, resourceId: this.requestId() };
      this.rows.set(null);
      this.next.set(null);
      this.through = undefined;
    }
    this.loading.set(true);
    this.api.audit(this.context.company.id, this.applied.purpose, this.next() ?? undefined, this.through, this.applied)
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: result => {
          this.rows.update(rows => [...(rows ?? []), ...result.data]);
          this.next.set(result.nextCursor);
          this.through = result.throughSequence;
          this.loading.set(false);
        },
        error: error => { this.error.set(apiErrorMessage(error)); this.loading.set(false); },
      });
  }
}
