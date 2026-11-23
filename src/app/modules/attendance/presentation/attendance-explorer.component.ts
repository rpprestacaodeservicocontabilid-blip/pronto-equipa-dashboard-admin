import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, Input, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, Subject, catchError, defer, forkJoin, from, map, mergeMap, of, switchMap, toArray } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { CompanyWorkspace } from '../../../core/api/company-workspace-api';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { dateKey, downloadCsv, duration, UUID, UUID_PATTERN, validDate } from '../domain/attendance-format';
import { AttendanceEntity, AttendanceFilter, AttendanceResource, AttendanceRow, Employee, Punch, Summary, isEntity, label } from '../domain/attendance.models';
import { ATTENDANCE_SECTIONS, can } from '../domain/attendance.sections';
import { AttendanceApi, DepartmentAssignment } from '../infrastructure/attendance-api.service';
import { AttendanceEditorComponent, EditorRequest } from './attendance-editor.component';

interface ViewData {
  rows: AttendanceRow[];
  total: number;
  periods?: AttendanceEntity[];
  pending?: number;
  pendingCorrections?: number;
  late?: number;
  recent?: Punch[];
  summary?: Summary;
  snapshots?: AttendanceEntity[];
  punches?: Punch[];
  rectifications?: AttendanceEntity[];
  pagedLocally?: boolean;
}

const DEVIATIONS = ['LATE_ARRIVAL', 'EARLY_DEPARTURE'];
const PERIOD_EDITABLE = ['OPEN', 'UNDER_REVIEW', 'READY_TO_CLOSE'];
const PAGE_SIZE = 20;

@Component({
  selector: 'app-attendance-explorer',
  standalone: true,
  imports: [DatePipe, FormsModule, NgTemplateOutlet, RouterLink, ComponentCardComponent, AttendanceEditorComponent],
  templateUrl: './attendance-explorer.component.html',
})
export class AttendanceExplorerComponent implements OnInit {
  @Input({ required: true }) context!: CompanyWorkspace;
  @Input({ required: true }) section!: (typeof ATTENDANCE_SECTIONS)[number];
  @Input() id = '';
  @Input() employeeFilter = '';

  private readonly api = inject(AttendanceApi);
  private readonly destroy = inject(DestroyRef);
  private readonly reload = new Subject<void>();
  protected readonly result = signal<ViewData | null>(null);
  protected readonly employeeList = signal<Employee[]>([]);
  protected readonly departments = signal<{ id: string; name: string; data: { establishmentId?: string } }[]>([]);
  protected readonly establishments = signal<{ id: string; name: string }[]>([]);
  private readonly assignments = signal<DepartmentAssignment[]>([]);
  protected readonly organizationReady = signal(false);
  protected readonly organizationError = signal('');
  protected readonly employeesById = computed(() => new Map(this.employeeList().map(employee => [employee.id, employee])));
  protected readonly departmentsById = computed(() => new Map(this.departments().map(department => [department.id, department])));
  private readonly assignmentsByEmployee = computed(() => {
    const grouped = new Map<string, DepartmentAssignment[]>();
    for (const assignment of this.assignments()) {
      const items = grouped.get(assignment.employeeId) ?? [];
      items.push(assignment);
      grouped.set(assignment.employeeId, items);
    }
    for (const items of grouped.values()) items.sort((a, b) => (b.effectiveFrom ?? '').localeCompare(a.effectiveFrom ?? ''));
    return grouped;
  });
  protected readonly loadError = signal('');
  protected readonly inputError = signal('');
  protected readonly loading = signal(false);
  protected readonly notice = signal('');
  protected readonly editor = signal<EditorRequest | null>(null);
  protected readonly label = label;
  protected readonly duration = duration;
  protected readonly isEntity = isEntity;
  protected readonly uuidPattern = UUID_PATTERN;
  protected readonly pageSize = PAGE_SIZE;
  protected readonly dayStates = ['PRESENT', 'PARTIAL', 'ABSENT', 'REST_DAY', 'INCOMPLETE', 'STALE'];
  protected readonly reports: { title: string; resource: AttendanceResource; kind?: string }[] = [
    { title: 'Attendance and hours worked', resource: 'days' },
    { title: 'Absences', resource: 'occurrences', kind: 'ABSENCE_UNCLASSIFIED' },
    { title: 'Late arrivals', resource: 'occurrences', kind: 'LATE_ARRIVAL' },
    { title: 'Early departures', resource: 'occurrences', kind: 'EARLY_DEPARTURE' },
    { title: 'All occurrences', resource: 'occurrences' },
    { title: 'Justifications', resource: 'justifications' },
    { title: 'Corrections and rectifications', resource: 'corrections' },
    { title: 'Attendance periods', resource: 'periods' },
  ];

  protected from = '';
  protected to = '';
  protected employee = '';
  protected department = '';
  protected establishment = '';
  protected status = '';
  protected reportIndex = -1;
  protected page = 1;
  private applied: AttendanceFilter = {};
  private scoped = { department: '', establishment: '', status: '' };

  protected get company() { return this.context.company.id; }
  protected get mode() { return this.section.path; }
  protected get resource() { return this.mode === 'reports' ? this.reports[this.reportIndex]?.resource : this.section.resource; }
  protected get availableReports() { return this.reports.filter(report => this.canRead(report.resource)); }
  protected get canReadList() { return !!this.resource && this.canRead(this.resource); }
  protected get hasDates() { return this.mode === 'reports' || this.resource !== 'periods'; }
  protected get hasEmployeeScope() { return this.mode !== 'reports' || (!!this.resource && this.resource !== 'periods'); }
  protected get statuses() {
    if (this.resource === 'days' || (this.mode === 'overview' && this.can('days.read'))) return this.dayStates;
    if (this.resource === 'occurrences') return ['PENDING', 'APPROVED', 'REJECTED', 'SUPERSEDED'];
    if (this.resource === 'justifications') return ['PENDING', 'APPROVED', 'REJECTED', 'RETURNED'];
    if (this.resource === 'corrections') return ['PENDING', 'APPROVED', 'REJECTED'];
    return [];
  }
  protected get rowPath() {
    return this.mode === 'map' || this.resource === 'days' ? 'daily'
      : this.mode === 'reports' && this.resource === 'occurrences' ? 'absences'
      : this.mode === 'reports' ? this.resource : this.mode;
  }

  ngOnInit() {
    this.reportIndex = this.can('reports.read') ? -1 : this.reports.findIndex(report => this.canRead(report.resource));
    this.employee = UUID.test(this.employeeFilter) ? this.employeeFilter : '';
    if (this.mode === 'overview' || this.mode === 'reports' || this.mode === 'map') {
      this.from = this.to = dateKey();
      if (this.mode === 'map') this.setRange('week');
    }
    if (this.context.permissions.includes('employees.read') &&
      (this.canReadList || this.mode === 'overview' || this.can('punches.create') || this.can('days.calculate'))) {
      this.api.employees(this.company).pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: rows => this.employeeList.set(rows), error: () => {},
      });
    }
    if (this.context.permissions.includes('organization:read') && (this.canReadList || this.mode === 'overview')) {
      const departments = this.api.departments(this.company).pipe(switchMap(departments => from(departments).pipe(
        mergeMap(department => this.api.departmentAssignments(this.company, department.id), 4),
        toArray(), map(assignments => ({ departments, assignments: assignments.flat() })),
      )));
      forkJoin({ references: departments, establishments: this.api.establishments(this.company) }).pipe(
        takeUntilDestroyed(this.destroy),
      ).subscribe({
        next: ({ references, establishments }) => {
          this.departments.set(references.departments);
          this.assignments.set(references.assignments);
          this.establishments.set(establishments);
          this.organizationReady.set(true);
        },
        error: error => this.organizationError.set('Organization filters are unavailable. ' + apiErrorMessage(error)),
      });
    }
    this.reload.pipe(
      switchMap(() => {
        this.loading.set(true);
        this.result.set(null);
        this.loadError.set('');
        return defer(() => this.load()).pipe(
          map(data => ({ data })),
          catchError(error => of({ error: apiErrorMessage(error) })),
        );
      }),
      takeUntilDestroyed(this.destroy),
    ).subscribe(response => {
      this.loading.set(false);
      if ('error' in response) this.loadError.set(response.error);
      else this.result.set(response.data);
    });
    this.apply();
  }

  protected can(permission: string) { return can(this.context.permissions, permission); }
  protected canRead(resource: AttendanceResource) { return this.can(resource + '.read'); }
  protected reportNumber(report: (typeof this.reports)[number]) { return this.reports.indexOf(report); }
  protected chooseReport(value: number) {
    this.reportIndex = value;
    this.status = '';
    this.apply();
  }
  protected retry() { this.reload.next(); }

  protected setRange(range: 'day' | 'week' | 'month') {
    const reference = validDate(this.from) ? new Date(this.from + 'T12:00:00') : new Date();
    const start = new Date(reference);
    const end = new Date(reference);
    if (range === 'week') {
      start.setDate(reference.getDate() - (reference.getDay() + 6) % 7);
      end.setTime(start.getTime());
      end.setDate(start.getDate() + 6);
    }
    if (range === 'month') {
      start.setDate(1);
      end.setMonth(end.getMonth() + 1, 0);
    }
    this.from = dateKey(start);
    this.to = dateKey(end);
  }

  protected apply() {
    this.inputError.set('');
    if (this.hasDates && this.from && this.to && this.from > this.to) {
      this.inputError.set('The start date must be on or before the end date.');
      return;
    }
    if ((this.mode === 'overview' || this.mode === 'reports' || this.mode === 'map') && this.hasDates && (!this.from || !this.to)) {
      this.inputError.set('Enter a start and end date.');
      return;
    }
    if (this.hasDates && this.hasEmployeeScope && this.employee && !UUID.test(this.employee)) {
      this.inputError.set('Enter a valid employee ID.');
      return;
    }
    if (this.mode === 'map' && (Date.parse(this.to) - Date.parse(this.from)) / 86_400_000 > 30) {
      this.inputError.set('Choose up to 31 days for the map.');
      return;
    }
    this.applied = this.hasDates ? {
      ...(this.from ? { from: this.from } : {}), ...(this.to ? { to: this.to } : {}),
      ...(this.employee && this.hasEmployeeScope ? { employeeId: this.employee } : {}),
    } : {};
    this.scoped = this.hasDates && this.hasEmployeeScope ? { department: this.department, establishment: this.establishment, status: this.status }
      : { department: '', establishment: '', status: '' };
    this.page = 1;
    this.reload.next();
  }

  protected go(page: number) {
    this.page = page;
    if (!this.result()?.pagedLocally) this.reload.next();
  }

  protected displayedRows(data: ViewData) {
    return data.pagedLocally ? data.rows.slice((this.page - 1) * PAGE_SIZE, this.page * PAGE_SIZE) : data.rows;
  }

  protected employeeName(id: string | null) {
    const employee = id ? this.employeesById().get(id) : undefined;
    return employee ? employee.firstName + ' ' + employee.lastName : id ?? '—';
  }

  protected employeeViews() {
    return [
      { path: 'overview', title: 'Employee overview', permission: 'days.read' },
      { path: 'records', title: 'Time records', permission: 'punches.read' },
      { path: 'daily', title: 'Daily attendance', permission: 'days.read' },
      { path: 'absences', title: 'Absences', permission: 'occurrences.read' },
      { path: 'deviations', title: 'Late arrivals and early departures', permission: 'occurrences.read' },
      { path: 'justifications', title: 'Justifications', permission: 'justifications.read' },
      { path: 'corrections', title: 'Corrections', permission: 'corrections.read' },
    ].filter(view => this.can(view.permission));
  }

  protected departmentName(row: AttendanceRow) {
    return this.departmentsById().get(this.departmentId(row))?.name ?? '—';
  }

  protected begin(request: EditorRequest) {
    this.notice.set('');
    this.editor.set(request);
  }

  protected saved(message: string) {
    this.notice.set(message);
    this.editor.set(null);
    this.reload.next();
  }

  protected primary() {
    switch (this.mode) {
      case 'records': return this.can('punches.create') ? { action: 'punch', label: 'Record manual punch' } as const : null;
      case 'daily': return this.can('days.calculate') ? { action: 'calculate', label: 'Recalculate workday' } as const : null;
      case 'justifications': return this.can('justifications.create') ? { action: 'justify', label: 'Submit justification' } as const : null;
      case 'corrections': return this.can('corrections.create') ? { action: 'correct', label: 'Request correction' } as const : null;
      case 'periods': return this.can('periods.manage') ? { action: 'period', label: 'Create period' } as const : null;
      default: return null;
    }
  }

  protected actions(row: AttendanceRow): { title: string; request: EditorRequest }[] {
    if (!isEntity(row)) return this.can('corrections.create') ? [{ title: 'Request correction', request: { action: 'correct', id: row.id } }] : [];
    if (row.type === 'DAY' && this.can('days.calculate') && row.employeeId && row.workDate) {
      return [{ title: 'Recalculate workday', request: { action: 'calculate', employeeId: row.employeeId, date: row.workDate } }];
    }
    if (row.type === 'OCCURRENCE' && row.status === 'PENDING' && this.can('justifications.create')) {
      return [{ title: 'Submit justification', request: { action: 'justify', id: row.id } }];
    }
    if (row.type === 'PERIOD') {
      const actions: { title: string; request: EditorRequest }[] = [];
      if (PERIOD_EDITABLE.includes(row.status) && this.can('periods.manage')) actions.push({ title: 'Validate period', request: { action: 'validate', id: row.id } });
      if (row.status === 'READY_TO_CLOSE' && this.can('periods.close')) actions.push({ title: 'Close period', request: { action: 'close', id: row.id } });
      if (['CLOSED', 'RECTIFICATION_PENDING'].includes(row.status) && this.can('corrections.create')) actions.push({ title: 'Request rectification', request: { action: 'rectify', id: row.id } });
      return actions;
    }
    const resource = row.type === 'JUSTIFICATION' ? 'justifications' : 'corrections';
    if (row.status === 'PENDING' && ['JUSTIFICATION', 'CORRECTION', 'RECTIFICATION'].includes(row.type) && this.can(resource + '.decide')) {
      const actions: { title: string; request: EditorRequest }[] = [
        { title: 'Approve', request: { action: 'approve', resource, id: row.id } },
        { title: 'Reject', request: { action: 'reject', resource, id: row.id } },
      ];
      if (resource === 'justifications') actions.push({ title: 'Return for correction', request: { action: 'return', resource, id: row.id } });
      return actions;
    }
    return [];
  }

  protected statusText(row: AttendanceRow) { return isEntity(row) ? label(row.status) : label(row.source); }
  protected resultText(row: AttendanceRow) {
    if (!isEntity(row)) return label(row.punchType) + ' · ' + row.timezone;
    if (row.type === 'DAY') return duration(row.data.workedMinutes) + ' / ' + duration(row.data.expectedMinutes);
    if (row.type === 'OCCURRENCE') return label(row.data.occurrenceType) + ' · ' + duration(row.data.durationMinutes);
    if (row.type === 'PERIOD') return row.periodStart + ' – ' + row.periodEnd;
    return row.data.reason || label(row.type);
  }

  protected exportRows(rows: AttendanceRow[]) {
    downloadCsv('attendance-' + this.mode + '.csv', [
      ['ID', 'Employee', 'Employee ID', 'Department', 'Work date', 'Status / source', 'Result', 'Worked minutes',
        'Expected minutes', 'Occurred at', 'Period start', 'Period end', 'Occurrence type', 'Duration minutes', 'Tolerance minutes'],
      ...rows.map(row => [row.id, this.employeeName(row.employeeId), row.employeeId, this.departmentName(row),
        row.workDate, this.statusText(row), this.resultText(row), isEntity(row) ? row.data.workedMinutes : '',
        isEntity(row) ? row.data.expectedMinutes : '', isEntity(row) ? '' : row.occurredAt,
        isEntity(row) ? row.periodStart : '', isEntity(row) ? row.periodEnd : '', isEntity(row) ? row.data.occurrenceType : '',
        isEntity(row) ? row.data.durationMinutes : '', isEntity(row) ? row.data.toleranceMinutes : '']),
    ]);
  }

  protected exportSummary(summary: Summary) {
    downloadCsv('attendance-summary.csv', [['From', 'To', 'Employee days', 'Worked minutes', 'Expected minutes'],
      [summary.from, summary.to, summary.dayCount, summary.workedMinutes, summary.expectedMinutes],
      [], ['Status', 'Employee days'], ...Object.entries(summary.statuses)]);
  }

  protected indicators(data: ViewData) {
    const days = data.rows.filter(isEntity);
    const present = data.summary?.statuses['PRESENT'] ?? (this.can('days.read') ? days.filter(row => row.status === 'PRESENT').length : undefined);
    const absent = data.summary?.statuses['ABSENT'] ?? (this.can('days.read') ? days.filter(row => row.status === 'ABSENT').length : undefined);
    return [
      { label: 'Present employee-days', value: present ?? '—' },
      { label: 'Absent employee-days', value: absent ?? '—' },
      { label: 'Late arrivals', value: data.late ?? '—' },
      { label: 'Pending justifications', value: data.pending ?? '—' },
      { label: 'Pending corrections', value: data.pendingCorrections ?? '—' },
    ];
  }

  protected breakdown(rows: AttendanceRow[], by: 'month' | 'department') {
    const result = new Map<string, { title: string; present: number; absent: number; other: number }>();
    for (const row of rows.filter(isEntity)) {
      const title = by === 'month' ? row.workDate?.slice(0, 7) : this.departmentName(row);
      if (!title) continue;
      const bucket = result.get(title) ?? { title, present: 0, absent: 0, other: 0 };
      bucket[row.status === 'PRESENT' ? 'present' : row.status === 'ABSENT' ? 'absent' : 'other']++;
      result.set(title, bucket);
    }
    return [...result.values()].sort((a, b) => a.title.localeCompare(b.title));
  }

  protected calendar(rows: AttendanceRow[]) {
    const dates: string[] = [];
    const date = new Date(this.applied.from + 'T00:00:00Z');
    while (date.getTime() <= Date.parse(this.applied.to ?? '')) {
      dates.push(date.toISOString().slice(0, 10));
      date.setUTCDate(date.getUTCDate() + 1);
    }
    const workers = new Map<string, Map<string, AttendanceEntity>>();
    for (const day of rows.filter(isEntity)) {
      if (!day.employeeId || !day.workDate) continue;
      if (!workers.has(day.employeeId)) workers.set(day.employeeId, new Map());
      workers.get(day.employeeId)!.set(day.workDate, day);
    }
    return { dates, workers: [...workers].sort(([a], [b]) => this.employeeName(a).localeCompare(this.employeeName(b))) };
  }

  protected evidenceLink(evidence: string | undefined) {
    return evidence && /^https:\/\//i.test(evidence) ? evidence : null;
  }

  private load(): Observable<ViewData> {
    if (this.id) {
      if (!this.canReadList || !this.resource) return of({ rows: [], total: 0 });
      if (!UUID.test(this.id)) throw new Error('Invalid attendance record ID.');
      const resource = this.resource;
      return this.api.detail(this.company, resource, this.id).pipe(switchMap(row => {
        const data = { rows: [row], total: 1 };
        if (resource === 'periods' && isEntity(row)) {
          const rectifications = this.can('corrections.read') && ['CLOSED', 'RECTIFICATION_PENDING'].includes(row.status)
            ? this.api.all(this.company, 'corrections', { from: row.periodStart ?? undefined, to: row.periodEnd ?? undefined })
              .pipe(map(items => items.filter(item => item.type === 'RECTIFICATION' && item.data.periodId === row.id)))
            : of(undefined);
          return forkJoin({ snapshots: this.api.snapshots(this.company, row.id), rectifications }).pipe(
            map(related => ({ ...data, ...related })),
          );
        }
        if (resource === 'days' && isEntity(row) && this.can('punches.read') && row.employeeId && row.workDate) {
          const ids = new Set(row.data.punchIds ?? []);
          return this.api.all<Punch>(this.company, 'punches', { employeeId: row.employeeId, from: row.workDate, to: row.workDate })
            .pipe(map(punches => ({ ...data, punches: punches.filter(punch => ids.has(punch.id)) })));
        }
        return of(data);
      }));
    }
    if (this.mode === 'overview') return this.overview();
    if (this.mode === 'reports') {
      const summary = !this.resource && this.can('reports.read') && this.applied.from && this.applied.to
        ? this.api.summary(this.company, this.applied.from, this.applied.to) : of(undefined);
      const resource = this.resource;
      const rows = resource ? this.api.all(this.company, resource, resource === 'periods' ? {} : this.applied).pipe(
        map(items => items.filter(row => resource === 'periods'
          ? (!this.applied.from || row.periodEnd! >= this.applied.from) && (!this.applied.to || row.periodStart! <= this.applied.to)
          : this.matches(row) && (!this.reports[this.reportIndex]?.kind
            || row.data.occurrenceType === this.reports[this.reportIndex].kind))),
      ) : of([]);
      return forkJoin({ summary, rows }).pipe(map(data => ({ ...data, total: data.rows.length, pagedLocally: true })));
    }
    if (!this.canReadList || !this.resource) return of({ rows: [], total: 0 });
    if (this.resource === 'occurrences' || this.mode === 'map' || this.scoped.department || this.scoped.establishment || this.scoped.status) {
      return this.api.all(this.company, this.resource, this.applied).pipe(map(items => {
        const rows = items.filter(row => this.matches(row) && (this.mode === 'absences'
          ? !DEVIATIONS.includes(isEntity(row) ? row.data.occurrenceType ?? '' : '')
          : this.mode !== 'deviations' || (isEntity(row) && DEVIATIONS.includes(row.data.occurrenceType ?? ''))));
        return { rows, total: rows.length, pagedLocally: this.mode !== 'map' };
      }));
    }
    return this.api.list<AttendanceRow>(this.company, this.resource, this.applied, this.page).pipe(
      map(result => ({ rows: result.data, total: result.total })),
    );
  }

  private overview() {
    const days = this.can('days.read') ? this.api.all(this.company, 'days', this.applied) : of([]);
    const summary = !this.can('days.read') && this.can('reports.read') && !this.applied.employeeId && !this.scoped.status
      && !this.scoped.department && !this.scoped.establishment && this.applied.from && this.applied.to
      ? this.api.summary(this.company, this.applied.from, this.applied.to) : of(undefined);
    const count = (resource: 'occurrences' | 'justifications' | 'corrections', predicate: (row: AttendanceEntity) => boolean) =>
      this.canRead(resource) ? this.api.all(this.company, resource, this.applied).pipe(
        map(rows => rows.filter(row => this.matchesOrganization(row) && predicate(row))),
      ) : of(undefined);
    const periods = this.can('periods.read') ? this.api.list(this.company, 'periods', {}, 1, 5).pipe(map(response => response.data)) : of([]);
    const recent = this.can('punches.read')
      ? (this.scoped.department || this.scoped.establishment || this.scoped.status
        ? this.api.all<Punch>(this.company, 'punches', this.applied).pipe(map(items => items.filter(item => this.matchesOrganization(item))))
        : this.api.list<Punch>(this.company, 'punches', this.applied, 1, 5).pipe(map(response => response.data))) : of([]);
    return forkJoin({
      rows: days, summary, periods, recent,
      late: count('occurrences', row => row.data.occurrenceType === 'LATE_ARRIVAL' && row.status !== 'SUPERSEDED'),
      pending: count('justifications', row => row.status === 'PENDING'),
      pendingCorrections: count('corrections', row => row.status === 'PENDING'),
    }).pipe(map(data => {
      const rows = data.rows.filter(row => this.matches(row));
      const dayKeys = new Set(rows.map(row => row.employeeId + ':' + row.workDate));
      const totalForStatus = (entries?: AttendanceEntity[]) => entries?.filter(row =>
        !this.scoped.status || dayKeys.has(row.employeeId + ':' + row.workDate)).length;
      const recent = data.recent.filter(row => !this.scoped.status || dayKeys.has(row.employeeId + ':' + row.workDate)).slice(0, 5);
      return { ...data, rows, recent, total: rows.length, late: totalForStatus(data.late), pending: totalForStatus(data.pending),
        pendingCorrections: totalForStatus(data.pendingCorrections) };
    }));
  }

  private matchesOrganization(row: AttendanceRow) {
    const department = this.departmentId(row);
    return (!this.scoped.department || department === this.scoped.department)
      && (!this.scoped.establishment || this.departmentsById().get(department)?.data.establishmentId === this.scoped.establishment);
  }

  private departmentId(row: AttendanceRow) {
    if (!row.employeeId) return '';
    const date = row.workDate ?? dateKey();
    const assignment = this.assignmentsByEmployee().get(row.employeeId)?.find(item =>
      item.status === 'ACTIVE' && (!item.effectiveFrom || item.effectiveFrom <= date) && (!item.effectiveTo || item.effectiveTo >= date));
    return assignment?.relatedId ?? '';
  }

  private matches(row: AttendanceRow) {
    return this.matchesOrganization(row) && (!this.scoped.status || (isEntity(row) && row.status === this.scoped.status));
  }
}
