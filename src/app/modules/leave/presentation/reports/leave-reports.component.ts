import { Component, DestroyRef, Input, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Observable, map, of, switchMap } from 'rxjs';
import { CompanyWorkspace, CompanyWorkspaceApi } from '../../../../core/api/company-workspace-api';
import { apiErrorMessage } from '../../../../core/api/api-error';
import { ComponentCardComponent } from '../../../../shared/components/common/component-card/component-card.component';
import { LeaveDirectory } from '../../application/leave-directory';
import { downloadSpreadsheet, printLeaveReport } from '../../application/leave-export';
import { LEAVE_STATUSES, LeaveRequest, ReportFilter } from '../../domain/leave.models';
import { dateKey, validRange } from '../../domain/leave-rules';
import { LeaveApi } from '../../infrastructure/leave-api.service';

const REPORTS = [
  { id: 'balances', label: 'Current leave balances', grant: 'leave.reports.read' },
  { id: 'taken', label: 'Days taken', grant: 'leave.reports.read' },
  { id: 'annual', label: 'Annual leave plan', grant: 'leave.requests.read' },
  { id: 'pending', label: 'Pending decisions', grant: 'leave.requests.read' },
  { id: 'department', label: 'Leave by department', grant: 'leave.requests.read' },
  { id: 'conflicts', label: 'Blocking leave overlaps', grant: 'leave.planning.read' },
  { id: 'ledger', label: 'Balance movements', grant: 'leave.accounts.read' },
] as const;
type Report = typeof REPORTS[number]['id'];
interface ReportData { title: string; headings: string[]; rows: (string | number)[][]; summary: string; grant: string; directoryUsed: boolean }

@Component({
  selector: 'app-leave-reports',
  standalone: true,
  imports: [FormsModule, ComponentCardComponent],
  templateUrl: './leave-reports.component.html',
})
export class LeaveReportsComponent {
  @Input({ required: true }) context!: CompanyWorkspace;
  private readonly api = inject(LeaveApi);
  private readonly workspace = inject(CompanyWorkspaceApi);
  private readonly destroy = inject(DestroyRef);
  protected readonly directory = inject(LeaveDirectory);
  protected readonly data = signal<ReportData | null>(null);
  protected readonly error = signal('');
  protected readonly loading = signal(false);
  protected readonly exporting = signal(false);
  protected readonly page = signal(1);
  protected readonly pageSize = 20;
  protected report: Report = 'balances';
  protected employee = '';
  protected department = '';
  protected from = dateKey().slice(0, 4) + '-01-01';
  protected to = dateKey().slice(0, 4) + '-12-31';

  protected get options() { return REPORTS.filter(entry => this.context.permissions.includes(entry.grant)); }

  protected load() {
    if (this.loading() || this.exporting() || !this.directory.ready()) return;
    this.error.set('');
    this.data.set(null);
    const option = this.options.find(entry => entry.id === this.report);
    if (!option) return;
    if (this.report !== 'balances' && !validRange(this.from, this.to)) {
      this.error.set('Enter a valid start and end date.');
      return;
    }
    if ((this.report === 'ledger' || this.report === 'conflicts') && !this.employee) {
      this.error.set('Select an employee for this report.');
      return;
    }
    this.loading.set(true);
    this.page.set(1);
    const filter = { ...(this.employee ? { employeeId: this.employee } : {}),
      ...(this.report === 'balances' ? {} : { startDate: this.from, endDate: this.to }) };
    const scope = this.report === 'department' ? this.department : '';
    const summary = [this.report === 'balances' ? 'Current balances' : this.from + ' – ' + this.to,
      this.employee ? this.directory.name(this.employee) : 'All employees', scope ? this.directory.departments().find(entry => entry.id === scope)?.name ?? '' : '']
      .filter(Boolean).join(' · ');
    this.fetch(filter, scope).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: payload => {
        this.data.set({ ...payload, title: option.label, grant: option.grant, summary,
          directoryUsed: this.context.permissions.includes('employees.read') });
        this.loading.set(false);
      },
      error: error => { this.error.set(apiErrorMessage(error)); this.loading.set(false); },
    });
  }

  private fetch(filter: ReportFilter, department: string): Observable<Pick<ReportData, 'headings' | 'rows'>> {
    const company = this.context.company.id;
    switch (this.report) {
      case 'balances':
        return this.api.balances(company, filter.employeeId).pipe(map(balances => ({
          headings: ['Employee', 'Entitled', 'Adjusted', 'Reserved', 'Used', 'Available'],
          rows: balances.map(row => [this.directory.name(row.employeeId), row.entitled, row.adjusted, row.reserved, row.used, row.available]),
        })));
      case 'taken':
        return this.api.takenDays(company, filter).pipe(map(result => ({
          headings: ['Employee scope', 'Days taken in ledger'],
          rows: [[filter.employeeId ? this.directory.name(filter.employeeId) : 'Company', result.days]],
        })));
      case 'conflicts':
        return this.api.conflicts(company, filter.employeeId!, { startDate: filter.startDate!, endDate: filter.endDate! }).pipe(map(conflicts => ({
          headings: ['Request UUID', 'Status', 'Overlap begins', 'Overlap ends'],
          rows: conflicts.map(row => [row.conflictingRequestId, LEAVE_STATUSES[row.conflictingStatus], row.overlapStart, row.overlapEnd]),
        })));
      case 'ledger':
        return this.api.accounts(company, filter.employeeId).pipe(switchMap(result => {
          const account = result.data[0];
          return account ? this.api.allMovements(company, account.id) : of([]);
        }), map(movements => ({
          headings: ['Recorded', 'Type', 'Days', 'Reason', 'Reference'],
          rows: movements.filter(row => row.createdAt.slice(0, 10) >= filter.startDate! && row.createdAt.slice(0, 10) <= filter.endDate!)
            .map(row => [row.createdAt, row.movementType, row.days, row.reason ?? '', row.referenceId ?? '']),
        })));
      default:
        return this.api.allRequests(company, { ...filter,
          ...(this.report === 'annual' ? { leaveType: 'ANNUAL' } : {}),
          ...(this.report === 'pending' ? { status: 'PENDING_APPROVAL' } : {}),
        }).pipe(map(rows => ({
          headings: ['Employee', 'Department', 'First day', 'Last day', 'Requested days', 'Status'],
          rows: rows.filter(row => this.directory.matches(row.employeeId, department)
            && (this.report !== 'annual' || (row.status !== 'REJECTED' && row.status !== 'CANCELLED')))
            .map(row => this.requestRow(row)),
        })));
    }
  }

  private requestRow(row: LeaveRequest) {
    return [this.directory.name(row.employeeId), this.directory.department(row.employeeId), row.startDate, row.endDate,
      row.requestedDays, LEAVE_STATUSES[row.status]];
  }

  protected export(format: 'excel' | 'pdf') {
    const report = this.data();
    if (!report || !report.rows.length || this.exporting()) return;
    this.exporting.set(true);
    this.error.set('');
    this.workspace.context(this.context.company.id).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: result => {
        if (!result.permissions.includes('leave.reports.read') || !result.permissions.includes(report.grant)
          || (report.directoryUsed && !result.permissions.includes('employees.read'))
          || (this.context.permissions.includes('organization:read') && !result.permissions.includes('organization:read'))) {
          this.error.set('Your company permissions changed. Reload this report before exporting.');
          this.exporting.set(false);
          return;
        }
        try {
          if (format === 'excel') downloadSpreadsheet(report.headings, report.rows);
          else printLeaveReport(report.title, result.company.name, report.headings, report.rows, report.summary);
        } catch (error) { this.error.set(apiErrorMessage(error)); }
        this.exporting.set(false);
      },
      error: error => { this.error.set(apiErrorMessage(error)); this.exporting.set(false); },
    });
  }
}
