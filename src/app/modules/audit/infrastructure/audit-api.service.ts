import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { API_CONFIG } from '../../../core/api/api-config';
import { AuditDashboard, AuditFilters, AuditMetrics, AuditObjectPage, AuditRecord, AuditRecordPage, AuditScope } from '../domain/audit.models';

interface Envelope<T> { data: T }

@Injectable({ providedIn: 'root' })
export class AuditApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_CONFIG).apiBaseUrl;

  records(scope: AuditScope, path: string, filters: AuditFilters, cursor?: number, throughSequence?: number) {
    return this.get<AuditRecordPage>(scope, path, { ...filters, cursor, throughSequence, limit: 25 });
  }
  record(scope: AuditScope, id: string) {
    return this.get<AuditRecord>(scope, 'records/' + encodeURIComponent(id));
  }
  dashboard(scope: AuditScope, path: string, filters: AuditFilters) {
    return this.get<AuditDashboard>(scope, path, filters);
  }
  objects(scope: AuditScope, path: string, offset: number, limit: number) {
    return this.get<AuditObjectPage>(scope, path, { offset, limit });
  }
  metrics(scope: AuditScope) { return this.get<AuditMetrics>(scope, 'admin/metrics'); }
  post<T = unknown>(scope: AuditScope, path: string, body: object) {
    return this.http.post<Envelope<T>>(this.url(scope, path), body, { headers: this.headers(scope) })
      .pipe(map(response => response.data));
  }
  download(scope: AuditScope, path: string) {
    return this.http.get(this.url(scope, path), { headers: this.headers(scope), responseType: 'blob' });
  }

  private get<T>(scope: AuditScope, path: string, input: object = {}) {
    const params = Object.fromEntries(Object.entries(input).filter(([, value]) => value != null && value !== ''));
    return this.http.get<Envelope<T>>(this.url(scope, path), { headers: this.headers(scope), params })
      .pipe(map(response => response.data));
  }
  private headers(scope: AuditScope) {
    let headers = new HttpHeaders({ 'X-Audit-Purpose': 'utf8:' + encodeURIComponent(scope.purpose) });
    if (scope.companyId) headers = headers.set('X-Company-Id', String(scope.companyId));
    return headers;
  }
  private url(scope: AuditScope, path: string) {
    return this.base + (scope.companyId ? '/audit/' : '/admin/audit/') + path;
  }
}
