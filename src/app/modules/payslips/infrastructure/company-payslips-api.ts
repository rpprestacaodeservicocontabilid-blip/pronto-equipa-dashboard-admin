import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { API_CONFIG } from '../../../core/api/api-config';
import { companyScope } from '../../../core/api/company-workspace-api';
import { ChoicePage, ClosedRun, CompanyBatch, CompanyPayslipPolicy, CompanyReceipt, CompanyTemplate,
  CompanyTemplateVersion, Correction, EmployeeResult, Filter, Issuance, PublishedVersion,
  ReceiptEvent, ReceiptPage, Summary, Verification, BatchProgress } from '../domain/company-payslips.models';

@Injectable({ providedIn: 'root' })
export class CompanyPayslipsApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_CONFIG).apiBaseUrl + '/payslips';
  list(company: number, filters: Filter, own = false) {
    const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
    return this.http.get<ReceiptPage>(this.base + (own ? '/me' : ''), { params, ...companyScope(company) });
  }
  receipt(company: number, id: string, own = false) { return this.get<CompanyReceipt>(company, (own ? '/me/' : '/') + id); }
  summary(company: number) { return this.get<Summary>(company, '/reports/summary'); }
  history(company: number, id: string) { return this.get<{ events: ReceiptEvent[] }>(company, '/' + id + '/history'); }
  corrections(company: number, id: string) { return this.get<Correction[]>(company, '/' + id + '/corrections'); }
  verify(company: number, id: string) { return this.get<Verification>(company, '/' + id + '/verification'); }
  publish(company: number, id: string) { return this.write<CompanyReceipt>(company, '/' + id + '/publish', { channel: 'PORTAL' }); }
  copy(company: number, id: string) { return this.write<CompanyReceipt>(company, '/' + id + '/duplicate-copy', {}); }
  pdf(company: number, id: string, action: 'download' | 'print', own = false) {
    return this.http.get(this.base + (own ? '/me/' : '/') + id + '/' + action, { responseType: 'blob', ...companyScope(company) });
  }
  export(company: number, format: string, reportType: string) {
    return this.http.post(this.base + '/exports', { format, reportType }, { responseType: 'blob', ...companyScope(company) });
  }
  runs(company: number, page: number) { return this.get<ChoicePage<ClosedRun>>(company, '/issuance/runs', { page }); }
  results(company: number, run: string, page: number, employeeId?: string) {
    return this.get<ChoicePage<EmployeeResult>>(company, '/issuance/runs/' + run + '/results', employeeId ? { page, employeeId } : { page });
  }
  versions(company: number) { return this.get<PublishedVersion[]>(company, '/issuance/templates'); }
  issue(company: number, input: Issuance, key: string) {
    const result = input.results[0];
    return this.write<CompanyReceipt>(company, '', {
      payrollRunId: input.payrollRunId, templateVersionId: input.templateVersionId, type: input.type,
      payrollResultId: result.id, employeeId: result.employeeId, idempotencyKey: key,
    });
  }
  correct(company: number, receipt: string, input: Issuance) {
    return this.write<Correction>(company, '/' + receipt + '/corrections', {
      payrollRunId: input.payrollRunId, templateVersionId: input.templateVersionId,
      payrollResultId: input.results[0].id, reason: input.reason,
    });
  }
  createBatch(company: number, input: Issuance) {
    return this.write<CompanyBatch>(company, '/batches', {
      payrollRunId: input.payrollRunId, templateVersionId: input.templateVersionId,
      type: input.type, employeeIds: input.results.map(result => result.employeeId),
    });
  }
  batches(company: number) { return this.get<CompanyBatch[]>(company, '/batches'); }
  batch(company: number, id: string) { return this.get<CompanyBatch>(company, '/batches/' + id); }
  progress(company: number, id: string) { return this.get<BatchProgress>(company, '/batches/' + id + '/progress'); }
  batchAction(company: number, id: string, action: 'generate' | 'retry-failed' | 'publish') {
    return this.write<{ published?: number }>(company, '/batches/' + id + '/' + action, {});
  }
  templates(company: number) { return this.get<CompanyTemplate[]>(company, '/templates'); }
  template(company: number, id: string) { return this.get<CompanyTemplate>(company, '/templates/' + id); }
  createTemplate(company: number, body: { code: string; name: string; description?: string }) {
    return this.write<CompanyTemplate>(company, '/templates', body);
  }
  createVersion(company: number, id: string, version: string, title: string) {
    return this.write<CompanyTemplateVersion>(company, '/templates/' + id + '/versions', { version, layoutConfig: { title } });
  }
  previewVersion(company: number, id: string, version: string) {
    return this.write<CompanyTemplateVersion>(company, '/templates/' + id + '/preview', { version });
  }
  publishVersion(company: number, id: string) {
    return this.write<CompanyTemplateVersion>(company, '/template-versions/' + id + '/publish', {});
  }
  policy(company: number) { return this.get<CompanyPayslipPolicy>(company, '/policies'); }
  updatePolicy(company: number, policy: Omit<CompanyPayslipPolicy, 'version'>) {
    return this.write<CompanyPayslipPolicy>(company, '/policies', policy, 'PUT');
  }
  link(company: number, employee: string, userId: number) {
    return this.write(company, '/employees/' + employee + '/link', { userId });
  }
  private get<T>(company: number, path: string, params: Record<string, string | number> = {}) {
    return this.http.get<{ data: T }>(this.base + path, { params, ...companyScope(company) }).pipe(map(value => value.data));
  }
  private write<T>(company: number, path: string, body: object, method = 'POST') {
    return this.http.request<{ data: T }>(method, this.base + path, { body, ...companyScope(company) }).pipe(map(value => value.data));
  }
}
