import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, Input, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';
import { CompanyWorkspace } from '../../../../core/api/company-workspace-api';
import { apiErrorMessage } from '../../../../core/api/api-error';
import { AuthService } from '../../../../core/auth/auth.service';
import { ComponentCardComponent } from '../../../../shared/components/common/component-card/component-card.component';
import { LeaveDirectory } from '../../application/leave-directory';
import {
  ACTIONS, LEAVE_STATUSES, LEAVE_TYPES, LeaveAction, LeaveBalance, LeaveConflict, LeaveDecision, LeaveRequest, Segment,
} from '../../domain/leave.models';
import { availableActions, checkedSegments, validRange } from '../../domain/leave-rules';
import { LeaveApi } from '../../infrastructure/leave-api.service';
import { LeaveDraftComponent } from './leave-draft.component';
import { LeavePeriodsComponent } from './leave-periods.component';

@Component({
  selector: 'app-leave-request-detail',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, ComponentCardComponent, LeaveDraftComponent, LeavePeriodsComponent],
  templateUrl: './leave-request-detail.component.html',
})
export class LeaveRequestDetailComponent implements OnInit {
  @Input({ required: true }) context!: CompanyWorkspace;
  @Input({ required: true }) id!: string;
  protected readonly directory = inject(LeaveDirectory);
  private readonly api = inject(LeaveApi);
  private readonly auth = inject(AuthService);
  private readonly destroy = inject(DestroyRef);

  protected readonly request = signal<LeaveRequest | null>(null);
  protected readonly balance = signal<LeaveBalance | null>(null);
  protected readonly actualDays = signal<number | null>(null);
  protected readonly conflicts = signal<LeaveConflict[] | null>(null);
  protected readonly history = signal<LeaveDecision[] | null>(null);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly stale = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly editing = signal(false);
  protected readonly action = signal<LeaveAction | null>(null);
  protected readonly labels = ACTIONS;
  protected readonly statuses = LEAVE_STATUSES;
  protected readonly types = LEAVE_TYPES;
  protected readonly options = computed(() => {
    const row = this.request();
    return row ? availableActions(row, this.context.permissions, Number(this.auth.claims()?.sub)) : [];
  });
  protected comments = '';
  protected from = '';
  protected to = '';
  protected reason = '';
  protected usedDays: number | null = null;
  protected segments: Segment[] = [];
  private attempt: { signature: string; key: string } | null = null;

  ngOnInit() { this.load(); }

  protected has(grant: string) { return this.context.permissions.includes(grant); }

  protected load() {
    if (this.loading() || this.busy()) return;
    this.loading.set(true);
    this.stale.set(false);
    this.error.set('');
    this.editing.set(false);
    this.action.set(null);
    this.conflicts.set(null);
    this.balance.set(null);
    this.actualDays.set(null);
    this.history.set(null);
    const company = this.context.company.id;
    this.api.request(company, this.id).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: record => {
        this.request.set(record);
        this.loading.set(false);
        this.fillDetails(company, record);
      },
      error: error => { this.request.set(null); this.loading.set(false); this.error.set(apiErrorMessage(error)); },
    });
  }

  private fillDetails(company: number, record: LeaveRequest) {
    forkJoin({
      history: this.api.history(company, record.id).pipe(map(response => response.approvals), catchError(() => of(null))),
      balance: this.has('leave.accounts.read') ? this.api.balance(company, record.accountId).pipe(catchError(() => of(null))) : of(null),
      usage: this.has('leave.accounts.read') && ['COMPLETED', 'PARTIALLY_COMPLETED'].includes(record.status)
        ? this.api.allMovements(company, record.accountId, 'USAGE').pipe(
          map(movements => {
            const recorded = movements.filter(entry => entry.referenceId === record.id);
            return recorded.length ? -recorded.reduce((days, entry) => days + entry.days, 0) : null;
          }), catchError(() => of(null))) : of(null),
      conflicts: this.has('leave.planning.read') && record.periods.length
        ? forkJoin(record.periods.map(period => this.api.conflicts(company, record.employeeId,
          { startDate: period.startDate, endDate: period.endDate }, record.id))).pipe(map(results => results.flat()), catchError(() => of(null)))
        : of(null),
    }).pipe(takeUntilDestroyed(this.destroy)).subscribe(result => {
      if (this.request()?.version !== record.version || this.loading()) return;
      this.history.set(result.history ?? record.approvals);
      this.balance.set(result.balance);
      this.actualDays.set(result.usage);
      this.conflicts.set(result.conflicts);
    });
  }

  protected open(action: LeaveAction, request: LeaveRequest) {
    this.error.set('');
    this.notice.set('');
    this.action.set(action);
    this.comments = '';
    this.reason = '';
    this.from = '';
    this.to = '';
    this.usedDays = action === 'complete' && request.status !== 'INTERRUPTED' && request.status !== 'PARTIALLY_COMPLETED' ? request.requestedDays : null;
    this.segments = request.periods.map(({ startDate, endDate }) => ({ startDate, endDate }));
  }

  protected confirm() {
    const request = this.request();
    const action = this.action();
    if (!request || !action || this.busy() || this.stale() || !this.options().includes(action)) return;
    this.error.set('');
    try {
      const body = this.payload(action, request);
      const signature = JSON.stringify([action, request.version, body]);
      const usesKey = action === 'approve' || action === 'cancel' || action === 'complete';
      if (usesKey && this.attempt?.signature !== signature) {
        this.attempt = { signature, key: crypto.randomUUID() };
      }
      this.busy.set(true);
      this.api.act(this.context.company.id, request, action, body, usesKey ? this.attempt?.key : undefined)
        .pipe(takeUntilDestroyed(this.destroy)).subscribe({
          next: () => { this.busy.set(false); this.notice.set('Leave request updated.'); this.load(); },
          error: error => {
            this.busy.set(false);
            const message = apiErrorMessage(error);
            this.stale.set(error instanceof HttpErrorResponse && error.status === 409 && /version|concurrent/i.test(message));
            this.error.set(message);
          },
        });
    } catch (error) { this.error.set(apiErrorMessage(error)); }
  }

  private payload(action: LeaveAction, request: LeaveRequest): object {
    switch (action) {
      case 'reject':
        if (!this.comments.trim()) throw new Error('Enter a rejection reason.');
        return { comments: this.comments.trim() };
      case 'approve':
      case 'return':
        return { comments: this.comments.trim() || null };
      case 'reschedule':
        return { segments: checkedSegments(this.segments) };
      case 'interrupt':
        if (!validRange(this.from, this.to) ||
            !request.periods.some(period => this.from >= period.startDate && this.to <= period.endDate)
            || !this.reason.trim()) throw new Error('Enter a reason and dates within one of the approved periods.');
        return { startDate: this.from, endDate: this.to, reason: this.reason.trim() };
      case 'complete':
        if (!Number.isInteger(this.usedDays) || !this.usedDays || this.usedDays < 1 || this.usedDays > Math.min(request.requestedDays, 366)) {
          throw new Error('Enter the actual number of days taken, up to the requested days.');
        }
        return { usedDays: this.usedDays };
      default: return {};
    }
  }
}
