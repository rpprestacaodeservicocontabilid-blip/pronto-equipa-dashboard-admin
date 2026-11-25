import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { API_CONFIG } from '../../../core/api/api-config';
import { companyScope } from '../../../core/api/company-workspace-api';
import { CompanyPaymentPage, CompanyPaymentPolicy, CompanyPaymentRow, CompanyPaymentSummary, CompanyProvider,
  Directory, PaymentExport, StatementImport } from '../domain/company-payments.models';

@Injectable({ providedIn: 'root' })
export class CompanyPaymentsApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_CONFIG).apiBaseUrl + '/payments';
  summary(company: number) { return this.get<CompanyPaymentSummary>(company, '/reports/summary'); }
  list(company: number, directory: Directory, page: number, status: string) {
    const path = '/' + (directory === 'integrations' ? 'provider-configurations' : directory);
    const limit = 25;
    if (directory === 'instructions' || directory === 'batches') {
      return this.http.get<CompanyPaymentPage>(this.base + path,
        { params: status ? { page, limit, status } : { page, limit }, ...companyScope(company) });
    }
    return this.get<CompanyPaymentRow[]>(company, path).pipe(map(items => {
      const rows = status ? items.filter(item => item.status === status) : items;
      return { page, limit, total: rows.length, data: rows.slice((page - 1) * limit, page * limit) };
    }));
  }
  accounts(company: number) { return this.get<CompanyPaymentRow[]>(company, '/bank-accounts'); }
  detail(company: number, view: Directory, id: string) { return this.get<CompanyPaymentRow>(company, '/' + view + '/' + id); }
  history(company: number, id: string) { return this.get<{ events: CompanyPaymentRow[] }>(company, '/instructions/' + id + '/history'); }
  attempts(company: number, id: string) { return this.get<{ attempts: CompanyPaymentRow[] }>(company, '/orders/' + id + '/attempts'); }
  providers(company: number, execution: boolean) {
    return this.get<CompanyProvider[]>(company, execution ? '/execution-providers' : '/providers');
  }
  policy(company: number) { return this.get<CompanyPaymentPolicy>(company, '/policies'); }
  export(company: number, reportType: string) { return this.write<PaymentExport>(company, '/exports', { format: 'CSV', reportType }); }
  receipt(company: number, transaction: string) {
    return this.http.get(this.base + '/transactions/' + transaction + '/receipt', { responseType: 'blob', ...companyScope(company) });
  }
  statement(company: number, input: object) { return this.write<StatementImport>(company, '/bank-statements/import', input); }
  write<T>(company: number, path: string, body: object, method = 'POST') {
    return this.http.request<{ data: T }>(method, this.base + path, { body, ...companyScope(company) }).pipe(map(result => result.data));
  }
  private get<T>(company: number, path: string) {
    return this.http.get<{ data: T }>(this.base + path, companyScope(company)).pipe(map(result => result.data));
  }
}
