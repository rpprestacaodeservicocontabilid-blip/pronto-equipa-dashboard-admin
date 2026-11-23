import { Component, DestroyRef, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';
import { CompanyWorkspace } from '../../../../core/api/company-workspace-api';
import { apiErrorMessage } from '../../../../core/api/api-error';
import { ComponentCardComponent } from '../../../../shared/components/common/component-card/component-card.component';
import { LeaveDirectory } from '../../application/leave-directory';
import { LEAVE_TYPES, LeaveConflict, LeaveRequest, LeaveType, Segment } from '../../domain/leave.models';
import { checkedSegments, dateKey } from '../../domain/leave-rules';
import { LeaveApi } from '../../infrastructure/leave-api.service';
import { LeavePeriodsComponent } from './leave-periods.component';

@Component({
  selector: 'app-leave-draft',
  standalone: true,
  imports: [FormsModule, RouterLink, ComponentCardComponent, LeavePeriodsComponent],
  templateUrl: './leave-draft.component.html',
})
export class LeaveDraftComponent implements OnInit {
  @Input({ required: true }) context!: CompanyWorkspace;
  @Input() request: LeaveRequest | null = null;
  @Output() changed = new EventEmitter<void>();
  @Output() dismissed = new EventEmitter<void>();
  protected readonly directory = inject(LeaveDirectory);
  private readonly api = inject(LeaveApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy = inject(DestroyRef);
  protected readonly types = Object.entries(LEAVE_TYPES) as [LeaveType, string][];
  protected employeeId = '';
  protected type: LeaveType = 'ANNUAL';
  protected reason = '';
  protected periods: Segment[] = [{ startDate: '', endDate: '' }];
  protected planYear = '';
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly preview = signal<{ days: number | null; conflicts: LeaveConflict[] | null } | null>(null);

  ngOnInit() {
    if (this.request) {
      this.employeeId = this.request.employeeId;
      this.type = this.request.leaveType;
      this.reason = this.request.reason ?? '';
      this.periods = this.request.periods.map(({ startDate, endDate }) => ({ startDate, endDate }));
    } else {
      const year = this.route.snapshot.queryParamMap.get('plan') ?? '';
      if (/^20\d{2}$/.test(year)) this.planYear = year;
      const employee = this.route.snapshot.queryParamMap.get('employee') ?? '';
      if (/^[a-f\d-]{36}$/i.test(employee)) this.employeeId = employee;
      const start = this.planYear ? this.planYear + '-01-01' : dateKey();
      this.periods = [{ startDate: start, endDate: start }];
    }
  }

  protected get allowed() {
    return this.request ? this.request.status === 'DRAFT' && this.has('leave.requests.update')
      : this.has('leave.requests.create') && this.has('employees.read');
  }

  protected has(permission: string) { return this.context.permissions.includes(permission); }

  private segments() {
    if (!this.employeeId) throw new Error('Select an employee.');
    const periods = checkedSegments(this.periods);
    if (this.planYear && periods.some(period => !period.startDate.startsWith(this.planYear) || !period.endDate.startsWith(this.planYear))) {
      throw new Error('Planned periods must fall within the selected year.');
    }
    return periods;
  }

  protected inspect() {
    if (!this.has('leave.planning.read') || this.busy()) return;
    this.error.set('');
    this.preview.set(null);
    try {
      const periods = this.segments();
      this.busy.set(true);
      const company = this.context.company.id;
      forkJoin({
        days: forkJoin(periods.map(period => this.api.calendar(company, period))).pipe(
          map(results => results.reduce((sum, result) => sum + result.workingDays, 0)), catchError(() => of(null))),
        conflicts: forkJoin(periods.map(period => this.api.conflicts(company, this.employeeId, period, this.request?.id))).pipe(
          map(results => results.flat()), catchError(() => of(null))),
      }).pipe(takeUntilDestroyed(this.destroy)).subscribe(result => { this.preview.set(result); this.busy.set(false); });
    } catch (error) { this.error.set(apiErrorMessage(error)); }
  }

  protected save() {
    if (!this.allowed || this.busy()) return;
    this.error.set('');
    try {
      const segments = this.segments();
      const company = this.context.company.id;
      const input = { leaveType: this.type, reason: this.reason.trim() || null, segments };
      const operation = this.request ? this.api.edit(company, this.request, input)
        : this.api.create(company, { ...input, employeeId: this.employeeId });
      this.busy.set(true);
      operation.pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: record => {
          this.busy.set(false);
          if (this.request) this.changed.emit();
          else void this.router.navigate(['/leave', company, 'requests', record.id]);
        },
        error: error => { this.error.set(apiErrorMessage(error)); this.busy.set(false); },
      });
    } catch (error) { this.error.set(apiErrorMessage(error)); }
  }
}
