import { DatePipe } from '@angular/common';
import { Component, DestroyRef, Input, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { CompanyWorkspace } from '../../../../core/api/company-workspace-api';
import { apiErrorMessage } from '../../../../core/api/api-error';
import { ComponentCardComponent } from '../../../../shared/components/common/component-card/component-card.component';
import { LeaveDirectory } from '../../application/leave-directory';
import { CalendarPreview, LEAVE_STATUSES, LeaveAbsence, LeaveBalance, LeaveRequest, LeaveStatus, RequestFilter, Segment } from '../../domain/leave.models';
import { addDays, dateAt, dateKey, isoDate, overlap } from '../../domain/leave-rules';
import { LeaveApi } from '../../infrastructure/leave-api.service';

const CALENDAR_STATES: readonly LeaveStatus[] = ['PENDING_APPROVAL', 'APPROVED', 'IN_PROGRESS', 'PARTIALLY_COMPLETED', 'INTERRUPTED', 'COMPLETED'];
const PLAN_STATES: readonly LeaveStatus[] = ['DRAFT', 'RETURNED', ...CALENDAR_STATES];
const MONTHS = Array.from({ length: 12 }, (_, month) => new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' })
  .format(new Date(Date.UTC(2020, month, 1))));
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export type LeavePlanningMode = 'overview' | 'calendar' | 'plans';

@Component({
  selector: 'app-leave-planning',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, ComponentCardComponent],
  templateUrl: './leave-planning.component.html',
})
export class LeavePlanningComponent implements OnInit {
  @Input({ required: true }) context!: CompanyWorkspace;
  @Input({ required: true }) mode!: LeavePlanningMode;
  protected readonly directory = inject(LeaveDirectory);
  private readonly api = inject(LeaveApi);
  private readonly destroy = inject(DestroyRef);
  protected readonly labels = LEAVE_STATUSES;
  protected readonly statuses = Object.entries(LEAVE_STATUSES) as [LeaveStatus, string][];
  protected readonly months = MONTHS;
  protected readonly dayLabels = DAYS;
  protected readonly requests = signal<LeaveRequest[] | null>(null);
  protected readonly balances = signal<LeaveBalance[] | null>(null);
  protected readonly workCalendar = signal<CalendarPreview | null>(null);
  protected readonly absences = signal<LeaveAbsence[] | null>(null);
  protected readonly absenceLoading = signal(false);
  protected readonly absenceError = signal('');
  protected readonly error = signal('');
  protected readonly loading = signal(false);
  protected readonly employee = signal('');
  protected readonly department = signal('');
  protected readonly status = signal<LeaveStatus | ''>('');
  protected readonly anchor = signal(dateKey());
  protected readonly year = signal(Number(dateKey().slice(0, 4)));
  protected readonly selectedDay = signal('');
  protected readonly view = signal<'month' | 'week' | 'list'>('month');
  protected site = '';

  protected readonly range = computed<Segment>(() => {
    const anchor = this.anchor();
    if (this.mode !== 'calendar') return { startDate: this.year() + '-01-01', endDate: this.year() + '-12-31' };
    const date = dateAt(anchor);
    if (this.view() === 'week') {
      const startDate = addDays(anchor, -((date.getUTCDay() + 6) % 7));
      return { startDate, endDate: addDays(startDate, 6) };
    }
    return { startDate: anchor.slice(0, 7) + '-01',
      endDate: isoDate(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))) };
  });
  protected readonly filtered = computed(() => {
    const period = this.range();
    return (this.requests() ?? []).filter(request => this.directory.matches(request.employeeId, this.department(), this.employee())
      && (!this.status() || request.status === this.status()) && request.periods.some(segment => overlap(segment, period)));
  });
  protected readonly calendarRows = computed(() => this.filtered().filter(request => CALENDAR_STATES.includes(request.status))
    .flatMap(request => request.periods.filter(period => overlap(period, this.range())).map(period => ({ request, period })))
    .sort((a, b) => a.period.startDate.localeCompare(b.period.startDate)));
  protected readonly dayRows = computed<LeaveAbsence[]>(() => {
    const date = this.selectedDay();
    const records = this.has('leave.planning.read') ? this.absences() ?? [] : this.calendarRows()
      .filter(row => row.period.startDate <= date && row.period.endDate >= date)
      .map(({ request, period }) => ({ ...period, employeeId: request.employeeId, requestId: request.id, status: request.status }));
    return records.filter(row => this.directory.matches(row.employeeId, this.department(), this.employee())
      && (!this.status() || row.status === this.status()));
  });
  protected readonly calendarDays = computed(() => {
    const { startDate, endDate } = this.range();
    if (this.mode !== 'calendar') return [];
    const padding = this.view() === 'week' ? 0 : (dateAt(startDate).getUTCDay() + 6) % 7;
    const numberOfDays = Math.round((+dateAt(endDate) - +dateAt(startDate)) / 86400000) + 1;
    const calendar = this.workCalendar()?.calendar;
    return Array.from({ length: padding + numberOfDays }, (_, index) => {
      if (index < padding) return null;
      const day = addDays(startDate, index - padding);
      const nonWorking = calendar ? (calendar.exceptions?.[day]
        ? calendar.exceptions[day] === 'NON_WORKING_DAY' : !calendar.workingWeekdays.includes(dateAt(day).getUTCDay())) : false;
      const rows = this.calendarRows().filter(row => row.period.startDate <= day && day <= row.period.endDate);
      return { day, nonWorking, count: new Set(rows.map(row => row.request.employeeId)).size };
    });
  });
  protected readonly planRows = computed(() => {
    const year = this.year();
    const employees = new Map<string, LeaveRequest[]>();
    for (const request of this.filtered()) {
      if (request.leaveType !== 'ANNUAL' || !PLAN_STATES.includes(request.status)) continue;
      const list = employees.get(request.employeeId) ?? [];
      list.push(request);
      employees.set(request.employeeId, list);
    }
    return [...employees].map(([employeeId, requests]) => ({
      employeeId, requests, months: MONTHS.map((_, month) => {
        const startDate = isoDate(new Date(Date.UTC(year, month, 1)));
        const endDate = isoDate(new Date(Date.UTC(year, month + 1, 0)));
        const matches = requests.filter(row => row.periods.some(period => overlap(period, { startDate, endDate })));
        const completed = matches.some(row => row.status === 'COMPLETED');
        return { matches, completed };
      }),
    })).sort((a, b) => this.directory.name(a.employeeId).localeCompare(this.directory.name(b.employeeId)));
  });
  protected readonly unplanned = computed(() => {
    const planned = new Set(this.planRows().map(row => row.employeeId));
    return this.directory.employees().filter(entry => entry.status === 'ACTIVE'
      && this.directory.matches(entry.id, this.department(), this.employee()) && !planned.has(entry.id));
  });
  protected readonly metrics = computed(() => {
    const rows = this.filtered();
    const count = (state: LeaveStatus) => rows.filter(row => row.status === state).length;
    const available = this.balances()?.filter(row => this.directory.matches(row.employeeId, this.department(), this.employee()))
      .reduce((total, row) => total + row.available, 0);
    const byWorker = new Map<string, LeaveRequest[]>();
    let clashes = 0;
    for (const request of rows.filter(row => CALENDAR_STATES.includes(row.status))) {
      const previous = byWorker.get(request.employeeId) ?? [];
      clashes += previous.filter(row => row.periods.some(a => request.periods.some(b =>
        overlap(a, b) && [a.startDate, b.startDate, this.range().startDate].sort().at(-1)! <=
          [a.endDate, b.endDate, this.range().endDate].sort()[0]))).length;
      previous.push(request);
      byWorker.set(request.employeeId, previous);
    }
    const requestData = this.requests() !== null;
    return [
      { label: 'Employees with annual leave planned', value: requestData ? this.planRows().length : null },
      { label: 'Pending decisions', value: requestData ? count('PENDING_APPROVAL') : null },
      { label: 'Available days now', value: available ?? null },
      { label: 'Overlapping request pairs', value: requestData ? clashes : null },
      { label: $localize`:@@ui-1j3qly2:Approved`, value: requestData ? count('APPROVED') : null },
      { label: $localize`:@@ui-1uofzaf:Rejected`, value: requestData ? count('REJECTED') : null },
      { label: 'Drafts', value: requestData ? count('DRAFT') : null },
    ];
  });

  ngOnInit() { this.load(); }
  protected has(grant: string) { return this.context.permissions.includes(grant); }

  protected load() {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    this.selectedDay.set('');
    this.absences.set(null);
    const company = this.context.company.id;
    const period = this.range();
    const filter: RequestFilter = { ...period, ...(this.mode === 'plans' ? { leaveType: 'ANNUAL' } : {}) };
    forkJoin({
      requests: this.has('leave.requests.read') ? this.api.allRequests(company, filter).pipe(catchError(error => {
        this.error.set(apiErrorMessage(error)); return of(null);
      })) : of(null),
      balances: this.mode === 'overview' && this.has('leave.reports.read') ? this.api.balances(company).pipe(catchError(() => of(null))) : of(null),
      calendar: this.mode === 'calendar' && this.has('leave.planning.read')
        ? this.api.calendar(company, period, this.site).pipe(catchError(error => {
          this.error.set(apiErrorMessage(error)); return of(null);
        })) : of(null),
    }).pipe(takeUntilDestroyed(this.destroy)).subscribe(results => {
      this.requests.set(results.requests);
      this.balances.set(results.balances);
      this.workCalendar.set(results.calendar);
      this.loading.set(false);
    });
  }

  protected changeYear(value: number) {
    if (!Number.isInteger(value) || value < 2000 || value > 2099) return;
    this.year.set(value);
    this.load();
  }

  protected move(step: number) {
    const date = dateAt(this.anchor());
    if (this.view() === 'week') this.anchor.set(addDays(this.anchor(), step * 7));
    else this.anchor.set(isoDate(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + step, 1))));
    this.load();
  }

  protected changeView(view: 'month' | 'week' | 'list') {
    this.view.set(view);
    this.load();
  }

  protected selectDay(day: string) {
    if (this.absenceLoading()) return;
    this.selectedDay.set(day);
    this.absenceError.set('');
    this.absences.set(null);
    if (!this.has('leave.planning.read')) return;
    this.absenceLoading.set(true);
    this.api.absences(this.context.company.id, day).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: rows => { if (this.selectedDay() === day) this.absences.set(rows); this.absenceLoading.set(false); },
      error: error => { if (this.selectedDay() === day) this.absenceError.set(apiErrorMessage(error)); this.absenceLoading.set(false); },
    });
  }
}
