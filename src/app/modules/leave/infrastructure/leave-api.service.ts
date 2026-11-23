import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { EMPTY, Observable, expand, map, toArray } from 'rxjs';
import { API_CONFIG } from '../../../core/api/api-config';
import { ApiPage, companyScope } from '../../../core/api/company-workspace-api';
import {
  CalendarPreview, DraftInput, EmployeeReference, Entitlement, EntitlementInput, LeaveAbsence, LeaveAccount,
  LeaveAction, LeaveAuditEvent, LeaveBalance, LeaveConflict, LeaveDecision, LeavePeriod, LeaveRequest, Movement,
  MovementType, OrganizationReference, ReportFilter, RequestFilter, Segment,
} from '../domain/leave.models';

type Parameters = Record<string, string | number>;
interface Data<T> { data: T }

@Injectable({ providedIn: 'root' })
export class LeaveApi {
  private readonly config = inject(API_CONFIG);
  private readonly http = inject(HttpClient);
  private url(path: string) { return this.config.apiBaseUrl + '/leave/' + path; }

  requests(company: number, filter: RequestFilter = {}, page = 1, limit = 20) {
    return this.http.get<ApiPage<LeaveRequest>>(this.url('requests'), {
      ...companyScope(company), params: { ...filter, page, limit },
    });
  }

  allRequests(company: number, filter: RequestFilter) {
    return this.collect(page => this.requests(company, filter, page, 100));
  }

  request(company: number, id: string) { return this.get<LeaveRequest>(company, this.path('requests', id)); }

  history(company: number, id: string) {
    return this.get<{ periods: LeavePeriod[]; approvals: LeaveDecision[] }>(company, this.path('requests', id) + '/history');
  }

  create(company: number, input: DraftInput & { employeeId: string }) {
    return this.post<LeaveRequest>(company, 'requests', input);
  }

  edit(company: number, request: LeaveRequest, input: DraftInput) {
    return this.http.patch<Data<LeaveRequest>>(this.url(this.path('requests', request.id)),
      { ...input, expectedVersion: request.version }, companyScope(company)).pipe(map(result => result.data));
  }

  act(company: number, request: LeaveRequest, action: LeaveAction, input: object = {}, key?: string) {
    const headers = companyScope(company).headers;
    return this.http.post<Data<LeaveRequest>>(this.url(this.path('requests', request.id) + '/' + action),
      { ...input, expectedVersion: request.version },
      { headers: { ...headers, ...(key ? { 'Idempotency-Key': key } : {}) } }).pipe(map(result => result.data));
  }

  accounts(company: number, employeeId = '', page = 1) {
    return this.http.get<ApiPage<LeaveAccount>>(this.url('accounts'), {
      ...companyScope(company), params: { page, limit: 20, ...(employeeId ? { employeeId } : {}) },
    });
  }

  account(company: number, id: string) { return this.get<LeaveAccount>(company, this.path('accounts', id)); }
  createAccount(company: number, employeeId: string) { return this.post<LeaveAccount>(company, 'accounts', { employeeId }); }
  balance(company: number, id: string) { return this.get<LeaveBalance>(company, this.path('accounts', id) + '/balance'); }
  entitlements(company: number, id: string) { return this.get<Entitlement[]>(company, this.path('accounts', id) + '/entitlements'); }

  movements(company: number, id: string, page: number, movementType: MovementType | '' = '') {
    return this.http.get<ApiPage<Movement>>(this.url(this.path('accounts', id) + '/movements'), {
      ...companyScope(company), params: { page, limit: 20, ...(movementType ? { movementType } : {}) },
    });
  }

  allMovements(company: number, id: string, movementType: MovementType | '' = '') {
    return this.collect(page => this.movements(company, id, page, movementType));
  }

  entitlement(company: number, id: string, input: EntitlementInput, recalculate: boolean) {
    return this.post<unknown>(company, this.path('accounts', id) + '/entitlements' + (recalculate ? '/recalculate' : ''), input);
  }

  adjust(company: number, id: string, days: number, reason: string, referenceId: string | null) {
    return this.post<unknown>(company, this.path('accounts', id) + '/adjustments', { days, reason, referenceId });
  }

  conflicts(company: number, employeeId: string, period: Segment, excludeRequestId?: string) {
    return this.get<LeaveConflict[]>(company, 'planning/conflicts', {
      ...period, employeeId, ...(excludeRequestId ? { excludeRequestId } : {}),
    });
  }

  calendar(company: number, period: Segment, establishmentId = '') {
    return this.get<CalendarPreview>(company, 'planning/calendar', {
      ...period, ...(establishmentId ? { establishmentId } : {}),
    });
  }

  absences(company: number, date: string) { return this.get<LeaveAbsence[]>(company, 'planning/absences', { date }); }

  balances(company: number, employeeId = '') {
    return this.collect(page => this.http.get<ApiPage<LeaveBalance>>(this.url('reports/balances'), {
      ...companyScope(company), params: { page, limit: 100, ...(employeeId ? { employeeId } : {}) },
    }));
  }

  takenDays(company: number, filter: ReportFilter) { return this.get<{ days: number }>(company, 'reports/taken-days', { ...filter }); }

  employees(company: number) {
    return this.collect(page => this.http.get<ApiPage<EmployeeReference>>(this.config.apiBaseUrl + '/company/employees', {
      ...companyScope(company), params: { page, limit: 100 },
    }));
  }

  references(company: number, resource: 'departments' | 'establishments') {
    return this.collect(page => this.http.get<ApiPage<OrganizationReference>>(this.config.apiBaseUrl + '/organization/' + resource, {
      ...companyScope(company), params: { page, limit: 100 },
    }));
  }

  audit(company: number, purpose: string, cursor?: number, throughSequence?: number, filter: ReportFilter & { action?: string; actorId?: string; resourceId?: string } = {}) {
    const { startDate, endDate, action, actorId, resourceId } = filter;
    return this.http.get<Data<{ data: LeaveAuditEvent[]; nextCursor: number | null; throughSequence: number }>>(
      this.config.apiBaseUrl + '/audit/records', {
        headers: { ...companyScope(company).headers, 'X-Audit-Purpose': purpose },
        params: { module: 'leave', limit: 30, ...(cursor == null ? {} : { cursor }),
          ...(throughSequence == null ? {} : { throughSequence }), ...(action ? { action } : {}), ...(actorId ? { actorId } : {}),
          ...(resourceId ? { resourceId } : {}),
          ...(startDate ? { from: startDate + 'T00:00:00Z' } : {}), ...(endDate ? { to: endDate + 'T23:59:59.999Z' } : {}),
        },
      },
    ).pipe(map(result => result.data));
  }

  private path(resource: 'requests' | 'accounts', id: string) {
    return resource + '/' + encodeURIComponent(id);
  }

  private get<T>(company: number, path: string, params: Parameters = {}) {
    return this.http.get<Data<T>>(this.url(path), { ...companyScope(company), params }).pipe(map(result => result.data));
  }

  private post<T>(company: number, path: string, input: unknown) {
    return this.http.post<Data<T>>(this.url(path), input, companyScope(company)).pipe(map(result => result.data));
  }

  private collect<T>(get: (page: number) => Observable<ApiPage<T>>) {
    return get(1).pipe(expand(result => result.pagination.page < result.pagination.totalPages ? get(result.pagination.page + 1) : EMPTY),
      toArray(), map(pages => pages.flatMap(page => page.data)));
  }
}
