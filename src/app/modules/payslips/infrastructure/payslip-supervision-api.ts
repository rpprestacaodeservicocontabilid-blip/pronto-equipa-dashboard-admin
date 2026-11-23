import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { API_CONFIG } from '../../../core/api/api-config';
import { AuditRow, Batch, BatchDetails, Company, CompanyPage, DateGrouping, DateRange, Overview, Page, Policy, TemplateVersion, VolumeFilter, VolumeRow } from '../domain/payslip-supervision.models';

interface Envelope<T> { data: T }

@Injectable({ providedIn: 'root' })
export class PayslipSupervisionApi {
  private readonly http = inject(HttpClient);
  private readonly url = inject(API_CONFIG).apiBaseUrl + '/platform/payslips/';

  companies(search: string, page: number) {
    return this.get<Page<Company>>('companies', { search, page, limit: 50 });
  }
  overview(scope: DateRange) { return this.get<Overview>('overview', scope); }
  volume(filters: VolumeFilter) { return this.get<VolumeRow[]>('volume', filters); }
  audit(scope: DateRange, granularity: DateGrouping) {
    return this.get<AuditRow[]>('audit', { ...scope, granularity });
  }
  batches(scope: DateRange & { companyId: number }, page: number, status: string, failures: boolean) {
    return this.get<CompanyPage<Batch>>('batches', { ...scope, page, status, failures: failures ? 'true' : undefined });
  }
  batch(companyId: number, id: string) {
    return this.get<BatchDetails>('companies/' + companyId + '/batches/' + encodeURIComponent(id), {});
  }
  templates(companyId: number, page: number) {
    return this.get<CompanyPage<TemplateVersion>>('templates', { companyId, page });
  }
  policies(companyId: number, page: number) {
    return this.get<CompanyPage<Policy>>('policies', { companyId, page });
  }
  export(filters: VolumeFilter) {
    return this.http.post(this.url + 'reports/export', filters, { responseType: 'blob' });
  }

  private get<T>(path: string, query: object) {
    const params = Object.fromEntries(Object.entries(query).filter(([, value]) => value !== undefined && value !== ''));
    return this.http.get<Envelope<T>>(this.url + path, { params }).pipe(map(response => response.data));
  }
}
