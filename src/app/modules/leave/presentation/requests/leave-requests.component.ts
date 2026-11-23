import { DatePipe } from '@angular/common';
import { Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { ApiPage, CompanyWorkspace } from '../../../../core/api/company-workspace-api';
import { apiErrorMessage } from '../../../../core/api/api-error';
import { ComponentCardComponent } from '../../../../shared/components/common/component-card/component-card.component';
import { LeaveDirectory } from '../../application/leave-directory';
import { LEAVE_STATUSES, LEAVE_TYPES, LeaveRequest, LeaveStatus, LeaveType, RequestFilter } from '../../domain/leave.models';
import { validRange } from '../../domain/leave-rules';
import { LeaveApi } from '../../infrastructure/leave-api.service';

@Component({
  selector: 'app-leave-requests',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, ComponentCardComponent],
  templateUrl: './leave-requests.component.html',
})
export class LeaveRequestsComponent implements OnInit {
  @Input({ required: true }) context!: CompanyWorkspace;
  @Input() mode: 'requests' | 'approvals' | 'history' = 'requests';
  protected readonly directory = inject(LeaveDirectory);
  private readonly api = inject(LeaveApi);
  private readonly destroy = inject(DestroyRef);
  protected readonly statuses = Object.entries(LEAVE_STATUSES) as [LeaveStatus, string][];
  protected readonly statusNames = LEAVE_STATUSES;
  protected readonly types = Object.entries(LEAVE_TYPES) as [LeaveType, string][];
  protected readonly typeNames = LEAVE_TYPES;
  protected readonly result = signal<ApiPage<LeaveRequest> | null>(null);
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected employee = '';
  protected department = '';
  protected status: LeaveStatus | '' = '';
  protected type: LeaveType | '' = '';
  protected from = '';
  protected to = '';
  protected actor = '';
  private filter: RequestFilter = {};
  private appliedDepartment = '';
  private appliedActor = '';

  ngOnInit() { this.search(); }

  protected search() {
    if (this.busy()) return;
    if (this.from && this.to && !validRange(this.from, this.to)) {
      this.error.set('Enter a valid date range.');
      return;
    }
    const status = this.mode === 'approvals' ? 'PENDING_APPROVAL' : this.status;
    this.filter = { ...(status ? { status } : {}), ...(this.employee ? { employeeId: this.employee } : {}),
      ...(this.type ? { leaveType: this.type } : {}), ...(this.from ? { startDate: this.from } : {}), ...(this.to ? { endDate: this.to } : {}) };
    this.appliedDepartment = this.department;
    this.appliedActor = this.actor.trim();
    this.load(1);
  }

  protected load(page: number) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    const company = this.context.company.id;
    const request = this.appliedDepartment || this.appliedActor ? this.api.allRequests(company, this.filter).pipe(map(rows => {
      const filtered = rows.filter(row => this.directory.matches(row.employeeId, this.appliedDepartment) &&
        (!this.appliedActor || row.approvals.some(decision => String(decision.approverUserId) === this.appliedActor)));
      return { data: filtered.slice((page - 1) * 20, page * 20),
        pagination: { page, limit: 20, total: filtered.length, totalPages: Math.ceil(filtered.length / 20) } };
    })) : this.api.requests(company, this.filter, page);
    request.pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: result => { this.result.set(result); this.busy.set(false); },
      error: error => { this.result.set(null); this.error.set(apiErrorMessage(error)); this.busy.set(false); },
    });
  }
}
