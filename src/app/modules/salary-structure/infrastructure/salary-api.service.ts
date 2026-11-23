import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, expand, map, reduce } from 'rxjs';
import { API_CONFIG } from '../../../core/api/api-config';
import { ApiPage, companyScope } from '../../../core/api/company-workspace-api';
import {
  AssignedComponent, Assignment, AuditEvent, Batch, Catalog, ComponentDetail, EffectiveSalary, Page, Policy,
  Query, Report, Revision, SalaryCollection, Simulation, Snapshot, StructureDetail, TableDetail,
} from '../domain/salary.models';
import { EmployeeSummary, EmploymentContract } from '../../contracts/domain/contracts.models';

interface Reply<T> { data: T }
export interface SalaryEmployee extends EmployeeSummary { jobCategory: string | null }

@Injectable({ providedIn: 'root' })
export class SalaryApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_CONFIG).apiBaseUrl;
  private readonly url = this.base + '/salary-structure/';

  page<T>(company: number, resource: SalaryCollection | `reports/${Report}`, query: Query = {}, page = 1, limit = 20) {
    return this.http.get<Reply<Page<T>>>(this.url + resource, { ...companyScope(company), params: { ...query, page, limit } })
      .pipe(map(result => result.data));
  }

  all<T>(get: (page: number) => Observable<Page<T>>) {
    return get(1).pipe(expand(result => result.page * result.limit < result.total ? get(result.page + 1) : EMPTY),
      reduce((rows, result) => { rows.push(...result.data); return rows; }, [] as T[]));
  }

  catalog(company: number, resource: Catalog, id: string) {
    return this.read<ComponentDetail | TableDetail | StructureDetail>(company, resource + '/' + encodeURIComponent(id));
  }

  assignment(company: number, id: string) { return this.read<Assignment>(company, 'assignments/' + encodeURIComponent(id)); }
  revision(company: number, id: string) { return this.read<Revision>(company, 'revisions/' + encodeURIComponent(id)); }
  batch(company: number, id: string) { return this.read<Batch>(company, 'revision-batches/' + encodeURIComponent(id)); }
  policies(company: number) { return this.read<Policy[]>(company, 'policies'); }
  history(company: number, employee: string) {
    return this.read<{ assignments: Assignment[]; components: AssignedComponent[] }>(company, 'employees/' + encodeURIComponent(employee) + '/history');
  }
  current(company: number, employee: string, effectiveDate: string) {
    return this.read<EffectiveSalary>(company, 'employees/' + encodeURIComponent(employee) + '/current', { effectiveDate });
  }
  snapshot(company: number, employee: string, effectiveDate: string) {
    return this.read<Snapshot>(company, 'employees/' + encodeURIComponent(employee) + '/snapshot', { effectiveDate });
  }
  simulate(company: number, input: unknown) { return this.post<Simulation>(company, 'simulations', input); }
  requestExport(company: number, report: Report, filters: Query) {
    return this.post<{ exportId: number; status: 'PENDING' }>(company, 'exports', { report, format: 'CSV', filters });
  }

  employees(company: number, search: string) {
    return this.http.get<ApiPage<SalaryEmployee>>(this.base + '/company/employees', {
      ...companyScope(company), params: { page: 1, limit: 20, search },
    }).pipe(map(result => result.data));
  }
  employee(company: number, id: string) {
    return this.http.get<Reply<SalaryEmployee>>(this.base + '/company/employees/' + encodeURIComponent(id), companyScope(company))
      .pipe(map(result => result.data));
  }
  directory(company: number) {
    return this.all(page => this.http.get<ApiPage<SalaryEmployee>>(this.base + '/company/employees', {
      ...companyScope(company), params: { page, limit: 100 },
    }).pipe(map(result => ({ data: result.data, total: result.pagination.total, page, limit: 100 }))));
  }
  activeContracts(company: number, employeeId: string) {
    return this.http.get<ApiPage<EmploymentContract>>(this.base + '/contracts', {
      ...companyScope(company), params: { employeeId, status: 'ACTIVE', page: 1, limit: 100 },
    }).pipe(map(result => result.data));
  }
  contract(company: number, id: string) {
    return this.http.get<Reply<EmploymentContract>>(this.base + '/contracts/' + encodeURIComponent(id), companyScope(company))
      .pipe(map(result => result.data));
  }

  audit(company: number, purpose: string, filter: { action?: string; resourceId?: string }, cursor?: number, throughSequence?: number) {
    return this.http.get<Reply<{ data: AuditEvent[]; nextCursor: number | null; throughSequence: number }>>(this.base + '/audit/records', {
      headers: { ...companyScope(company).headers, 'X-Audit-Purpose': purpose },
      params: { module: 'salary-structure', limit: 30, ...filter, ...(cursor == null ? {} : { cursor }),
        ...(throughSequence == null ? {} : { throughSequence }) },
    }).pipe(map(result => result.data));
  }

  post<T = unknown>(company: number, path: string, body: unknown = {}) {
    return this.http.post<Reply<T>>(this.url + path, body, companyScope(company)).pipe(map(result => result.data));
  }
  patch<T = unknown>(company: number, path: string, body: unknown) {
    return this.http.patch<Reply<T>>(this.url + path, body, companyScope(company)).pipe(map(result => result.data));
  }
  private read<T>(company: number, path: string, params: Record<string, string> = {}) {
    return this.http.get<Reply<T>>(this.url + path, { ...companyScope(company), params }).pipe(map(result => result.data));
  }
}
