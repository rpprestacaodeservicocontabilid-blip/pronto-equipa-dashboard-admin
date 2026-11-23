import { DatePipe } from '@angular/common';
import { Component, DestroyRef, Input, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CompanyWorkspace } from '../../../../core/api/company-workspace-api';
import { apiErrorMessage } from '../../../../core/api/api-error';
import { ComponentCardComponent } from '../../../../shared/components/common/component-card/component-card.component';
import { LeaveDirectory } from '../../application/leave-directory';
import { LEAVE_STATUSES, LeaveAbsence, LeaveConflict } from '../../domain/leave.models';
import { dateKey, validRange } from '../../domain/leave-rules';
import { LeaveApi } from '../../infrastructure/leave-api.service';

@Component({
  selector: 'app-leave-conflicts',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, ComponentCardComponent],
  templateUrl: './leave-conflicts.component.html',
})
export class LeaveConflictsComponent {
  @Input({ required: true }) context!: CompanyWorkspace;
  private readonly api = inject(LeaveApi);
  private readonly destroy = inject(DestroyRef);
  protected readonly directory = inject(LeaveDirectory);
  protected readonly statuses = LEAVE_STATUSES;
  protected employeeId = '';
  protected from = dateKey();
  protected to = this.from;
  protected date = this.from;
  protected readonly department = signal('');
  protected readonly overlaps = signal<LeaveConflict[] | null>(null);
  protected readonly absences = signal<LeaveAbsence[] | null>(null);
  protected readonly filtered = computed(() => this.absences()?.filter(row => this.directory.matches(row.employeeId, this.department())) ?? []);
  protected readonly count = computed(() => new Set(this.filtered().map(row => row.employeeId)).size);
  protected readonly checking = signal(false);
  protected readonly loading = signal(false);
  protected readonly conflictError = signal('');
  protected readonly availabilityError = signal('');
  protected readonly inspectedDate = signal('');

  protected get canSeeRequests() { return this.context.permissions.includes('leave.requests.read'); }

  protected check() {
    if (this.checking()) return;
    this.overlaps.set(null);
    this.conflictError.set('');
    if (!this.employeeId || !validRange(this.from, this.to)) {
      this.conflictError.set('Select an employee and a valid date range.');
      return;
    }
    this.checking.set(true);
    this.api.conflicts(this.context.company.id, this.employeeId, { startDate: this.from, endDate: this.to })
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: rows => { this.overlaps.set(rows); this.checking.set(false); },
        error: error => { this.conflictError.set(apiErrorMessage(error)); this.checking.set(false); },
      });
  }

  protected inspectAvailability() {
    if (this.loading() || !this.date) return;
    this.loading.set(true);
    this.availabilityError.set('');
    this.absences.set(null);
    this.inspectedDate.set(this.date);
    this.api.absences(this.context.company.id, this.date).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: rows => { this.absences.set(rows); this.loading.set(false); },
      error: error => { this.availabilityError.set(apiErrorMessage(error)); this.loading.set(false); },
    });
  }
}
