import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { AuditPurpose } from '../application/audit-purpose.service';

@Component({
  selector: 'app-audit-purpose',
  standalone: true,
  imports: [FormsModule, ComponentCardComponent],
  styleUrl: './audit.css',
  template: `
    <app-component-card title="Audit purpose">
      @if (purpose.value() && !editing()) {
        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="text-sm break-words text-gray-800 dark:text-gray-200">{{ purpose.value() }}</p>
          <button type="button" class="aud-secondary" (click)="draft = purpose.value(); editing.set(true)">Change purpose</button>
        </div>
      } @else {
        <form class="flex flex-wrap items-end gap-3" (ngSubmit)="apply()">
          <label class="aud-label min-w-56 flex-1">Reason for accessing the audit trail
            <input class="aud-control" name="purpose" [(ngModel)]="draft" maxlength="500" required autocomplete="off" placeholder="For example, review access for case 184">
          </label>
          <button type="submit" class="aud-button" [disabled]="draft.trim().length < 3">Apply purpose</button>
          @if (purpose.value()) { <button type="button" class="aud-secondary" (click)="editing.set(false)">Cancel</button> }
        </form>
        <p class="aud-muted mt-3">The reason is recorded in the audit trail. Use a case reference in place of personal details.</p>
      }
    </app-component-card>
  `,
})
export class AuditPurposeComponent {
  protected readonly purpose = inject(AuditPurpose);
  @Output() applied = new EventEmitter<void>();
  protected readonly editing = signal(false);
  protected draft = '';

  protected apply() {
    if (this.draft.trim().length < 3) return;
    this.purpose.set(this.draft);
    this.editing.set(false);
    this.applied.emit();
  }
}
