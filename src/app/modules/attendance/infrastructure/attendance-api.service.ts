import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, expand, map, toArray } from 'rxjs';
import { API_CONFIG } from '../../../core/api/api-config';
import { ApiPage, companyScope } from '../../../core/api/company-workspace-api';
import {
  AttendanceEntity, AttendanceFilter, AttendancePage, AttendanceResource, AttendanceRow, AuditEvent,
  Employee, ImportResult, Punch, PunchInput, PunchType, Summary,
} from '../domain/attendance.models';

type Parameters = Record<string, string | number>;
export type CorrectionInput = { reason: string; punchType?: PunchType; occurredAt?: string };
export type PolicyInput = { lateToleranceMinutes: number; earlyDepartureToleranceMinutes: number; separationOfDuties: boolean };
export interface DepartmentAssignment {
  employeeId: string;
  relatedId: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  status: string;
}

@Injectable({ providedIn: 'root' })
export class AttendanceApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_CONFIG).apiBaseUrl;
  private readonly url = this.base + '/attendance/';

  list<T extends AttendanceRow = AttendanceEntity>(
    companyId: number, resource: AttendanceResource, filter: AttendanceFilter = {}, page = 1, limit = 20,
  ) {
    return this.http.get<AttendancePage<T>>(this.url + resource, {
      ...companyScope(companyId), params: { ...filter, page, limit },
    });
  }

  all<T extends AttendanceRow = AttendanceEntity>(companyId: number, resource: AttendanceResource, filter: AttendanceFilter) {
    return this.collect(page => this.list<T>(companyId, resource, filter, page, 100).pipe(
      map(result => ({ data: result.data, more: page * result.limit < result.total })),
    ));
  }

  detail(companyId: number, resource: AttendanceResource, id: string) {
    return this.get<AttendanceRow>(companyId, this.path(resource, id));
  }

  snapshots(companyId: number, id: string) { return this.get<AttendanceEntity[]>(companyId, this.path('periods', id) + '/snapshots'); }
  summary(companyId: number, from: string, to: string) { return this.get<Summary>(companyId, 'reports/summary', { from, to }); }

  createPunch(companyId: number, input: PunchInput) { return this.post<Punch>(companyId, 'punches', input); }
  calculate(companyId: number, employeeId: string, workDate: string) {
    return this.post<unknown>(companyId, 'days/recalculate', { employeeId, workDate });
  }
  justify(companyId: number, occurrenceId: string, reason: string, evidence?: string) {
    return this.post<AttendanceEntity>(companyId, this.path('occurrences', occurrenceId) + '/justifications', { reason, evidence });
  }
  correct(companyId: number, recordId: string, changes: CorrectionInput, periodId?: string) {
    return this.post<AttendanceEntity>(companyId, periodId ? this.path('periods', periodId) + '/rectifications' : 'corrections', { recordId, ...changes });
  }
  decide(companyId: number, resource: 'justifications' | 'corrections', id: string, action: 'approve' | 'reject' | 'return', reason?: string) {
    return this.post<AttendanceEntity>(companyId, this.path(resource, id) + '/' + action, { reason });
  }
  createPeriod(companyId: number, startDate: string, endDate: string) {
    return this.post<AttendanceEntity>(companyId, 'periods', { startDate, endDate });
  }
  periodAction(companyId: number, id: string, action: 'validate' | 'close') {
    return this.post<{ period: AttendanceEntity }>(companyId, this.path('periods', id) + '/' + action, {});
  }
  savePolicy(companyId: number, policy: PolicyInput) { return this.post<AttendanceEntity>(companyId, 'policy', policy); }
  import(companyId: number, batchKey: string, rows: PunchInput[]) {
    return this.post<ImportResult>(companyId, 'punches/import', { batchKey, rows });
  }

  employees(companyId: number) {
    return this.referencePages<Employee>(companyId, '/company/employees');
  }

  departments(companyId: number) {
    return this.referencePages<{ id: string; name: string; data: { establishmentId?: string } }>(companyId, '/organization/departments');
  }

  establishments(companyId: number) {
    return this.referencePages<{ id: string; name: string }>(companyId, '/organization/establishments');
  }

  departmentAssignments(companyId: number, departmentId: string) {
    return this.referencePages<DepartmentAssignment>(companyId, '/organization/departments/' + encodeURIComponent(departmentId) + '/employees');
  }

  audit(companyId: number, purpose: string, filter: { action?: string; resourceId?: string }, cursor?: number, throughSequence?: number) {
    return this.http.get<{ data: { data: AuditEvent[]; nextCursor: number | null; throughSequence: number } }>(
      this.base + '/audit/records', {
        headers: { ...companyScope(companyId).headers, 'X-Audit-Purpose': purpose },
        params: { module: 'attendance', limit: 30, ...filter, ...(cursor == null ? {} : { cursor }),
          ...(throughSequence == null ? {} : { throughSequence }) },
      },
    ).pipe(map(response => response.data));
  }

  private referencePages<T>(companyId: number, path: string) {
    return this.collect(page => this.http.get<ApiPage<T>>(this.base + path, {
      ...companyScope(companyId), params: { page, limit: 100 },
    }).pipe(map(result => ({ data: result.data, more: page < result.pagination.totalPages }))));
  }

  private collect<T>(get: (page: number) => Observable<{ data: T[]; more: boolean }>) {
    return get(1).pipe(
      expand((result, index) => result.more ? get(index + 2) : EMPTY),
      toArray(), map(pages => pages.flatMap(page => page.data)),
    );
  }

  private path(resource: AttendanceResource, id: string) {
    return (resource === 'punches' ? 'records' : resource) + '/' + encodeURIComponent(id);
  }
  private get<T>(companyId: number, path: string, params: Parameters = {}) {
    return this.http.get<{ data: T }>(this.url + path, { ...companyScope(companyId), params }).pipe(map(result => result.data));
  }
  private post<T>(companyId: number, path: string, input: unknown) {
    return this.http.post<{ data: T }>(this.url + path, input, companyScope(companyId)).pipe(map(result => result.data));
  }
}
