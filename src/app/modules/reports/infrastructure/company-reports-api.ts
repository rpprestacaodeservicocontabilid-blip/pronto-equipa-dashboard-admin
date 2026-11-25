import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { API_CONFIG } from '../../../core/api/api-config';
import { companyScope } from '../../../core/api/company-workspace-api';
import { CompanyIndicators, CompanyReport, CompanyReportResult, CustomPreview, CustomReport,
  ReportConfiguration, ReportFile, ReportFilters, RunSummary } from '../domain/company-reports.models';
import { Format } from '../domain/platform-reports.models';

interface Envelope<T> { data: T }
@Injectable({ providedIn: 'root' })
export class CompanyReportsApi {
  private readonly http = inject(HttpClient);
  private readonly url = inject(API_CONFIG).apiBaseUrl + '/reports/';

  catalogue(company: number) { return this.get<CompanyReport[]>(company, 'catalog'); }
  definition(company: number, code: string) { return this.get<ReportConfiguration>(company, 'catalog/' + encodeURIComponent(code)); }
  dashboard(company: number, filters: ReportFilters) { return this.get<CompanyIndicators>(company, 'dashboard', filters); }
  run(company: number, code: string, filters: ReportFilters) { return this.post<CompanyReportResult>(company, 'executions', { code, filters }); }
  history(company: number) { return this.get<RunSummary[]>(company, 'executions', { limit: 100 }); }
  result(company: number, id: string) { return this.get<CompanyReportResult>(company, 'executions/' + encodeURIComponent(id)); }
  exports(company: number) { return this.get<ReportFile[]>(company, 'exports'); }
  exportExecution(company: number, id: string, format: Format) {
    return this.post<ReportFile>(company, 'executions/' + encodeURIComponent(id) + '/exports', { format });
  }
  download(company: number, id: string) {
    return this.http.get(this.url + 'exports/' + encodeURIComponent(id) + '/download', { responseType: 'blob', ...companyScope(company) });
  }
  templates(company: number) { return this.get<CustomReport[]>(company, 'custom'); }
  createTemplate(company: number, input: { name: string; code: string; fields: string[]; filters: ReportFilters }) {
    return this.post<CustomReport>(company, 'custom', input);
  }
  previewTemplate(company: number, id: string) {
    return this.post<CustomPreview>(company, 'custom/' + encodeURIComponent(id) + '/preview', {});
  }
  publishTemplate(company: number, id: string) {
    return this.post<CustomReport>(company, 'custom/' + encodeURIComponent(id) + '/publish', {});
  }

  private get<T>(company: number, path: string, filters: ReportFilters = {}) {
    const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== ''));
    return this.http.get<Envelope<T>>(this.url + path, { params, ...companyScope(company) }).pipe(map(result => result.data));
  }
  private post<T>(company: number, path: string, body: object) {
    return this.http.post<Envelope<T>>(this.url + path, body, companyScope(company)).pipe(map(result => result.data));
  }
}
