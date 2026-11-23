import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { EMPTY, Observable, expand, map, toArray } from 'rxjs';
import { API_CONFIG } from '../../../core/api/api-config';
import { ApiPage, companyScope } from '../../../core/api/company-workspace-api';
import {
  AuditEvent, ChildResource, CostAllocations, DepartmentNode, OrganizationHistory,
  OrganizationInput, OrganizationQuery, OrganizationRecord, Resource,
} from '../domain/organization.models';

interface Data<T> { data: T }
export interface EmployeeOption { id: string; firstName: string; lastName: string; employeeNumber: string }
type Collection = Resource | 'schedule-assignments' | `${Resource}/${string}/${ChildResource}`;
export function childCollection(resource: Resource, id: string, child: ChildResource): Collection {
  return `${resource}/${encodeURIComponent(id)}/${child}`;
}

@Injectable({ providedIn: 'root' })
export class OrganizationApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(API_CONFIG);
  private url(path: string) { return this.config.apiBaseUrl + '/organization/' + path; }

  page(companyId: number, collection: Collection, query: OrganizationQuery = {}, page = 1, limit = 20) {
    return this.http.get<ApiPage<OrganizationRecord>>(this.url(collection), {
      ...companyScope(companyId), params: { ...query, page, limit },
    });
  }

  all(companyId: number, collection: Collection, query: OrganizationQuery = {}) {
    return this.collect(page => this.page(companyId, collection, query, page, 100));
  }

  employees(companyId: number, search = '') {
    return this.collect(page => this.http.get<ApiPage<EmployeeOption>>(this.config.apiBaseUrl + '/company/employees', {
      ...companyScope(companyId), params: { page, limit: 100, search },
    }));
  }

  tree(companyId: number) {
    return this.http.get<Data<DepartmentNode[]>>(this.url('departments/tree'), companyScope(companyId))
      .pipe(map(result => result.data));
  }

  get(companyId: number, resource: Resource, id: string) {
    return this.http.get<Data<OrganizationRecord>>(this.url(resource + '/' + encodeURIComponent(id)), companyScope(companyId))
      .pipe(map(result => result.data));
  }

  create(companyId: number, collection: Collection, input: OrganizationInput) {
    return this.post<OrganizationRecord>(companyId, collection, input);
  }

  allocations(companyId: number, input: CostAllocations) {
    return this.post<OrganizationRecord[]>(companyId, 'cost-allocations', input);
  }

  update(companyId: number, resource: Resource, record: OrganizationRecord, changes: Partial<OrganizationInput>) {
    return this.http.patch<Data<OrganizationRecord>>(this.url(resource + '/' + encodeURIComponent(record.id)), {
      ...changes, expectedVersion: record.version,
    }, companyScope(companyId)).pipe(map(result => result.data));
  }

  status(companyId: number, resource: Resource, record: OrganizationRecord) {
    const action = record.status === 'ACTIVE' ? 'deactivate' : 'activate';
    return this.post<OrganizationRecord>(companyId, resource + '/' + encodeURIComponent(record.id) + '/' + action,
      { expectedVersion: record.version });
  }

  move(companyId: number, record: OrganizationRecord, parentId: string | null) {
    return this.http.patch<Data<OrganizationRecord>>(this.url('departments/' + encodeURIComponent(record.id) + '/parent'), {
      parentId, expectedVersion: record.version,
    }, companyScope(companyId)).pipe(map(result => result.data));
  }

  history(companyId: number, resource: Resource, id: string) {
    return this.http.get<Data<OrganizationHistory[]>>(this.url(resource + '/' + encodeURIComponent(id) + '/history'),
      companyScope(companyId)).pipe(map(result => result.data));
  }

  audit(companyId: number, purpose: string, cursor?: number, throughSequence?: number, limit = 20) {
    return this.http.get<Data<{ data: AuditEvent[]; nextCursor: number | null; throughSequence: number }>>(
      this.config.apiBaseUrl + '/audit/records', {
        headers: { ...companyScope(companyId).headers, 'X-Audit-Purpose': purpose },
        params: { module: 'organization', limit, ...(cursor != null ? { cursor } : {}),
          ...(throughSequence != null ? { throughSequence } : {}) },
      },
    ).pipe(map(result => result.data));
  }

  private post<T>(companyId: number, path: string, body: unknown) {
    return this.http.post<Data<T>>(this.url(path), body, companyScope(companyId)).pipe(map(result => result.data));
  }

  private collect<T>(get: (page: number) => Observable<ApiPage<T>>) {
    return get(1).pipe(
      expand(result => result.pagination.page < result.pagination.totalPages ? get(result.pagination.page + 1) : EMPTY),
      toArray(),
      map(pages => pages.flatMap(page => page.data)),
    );
  }
}
