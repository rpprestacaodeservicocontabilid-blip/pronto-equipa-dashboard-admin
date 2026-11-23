import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { API_CONFIG } from '../../../core/api/api-config';
import { BillingAccount, BillingCursor, BillingFilters, BillingKind, BillingOverview, BillingPage, BillingRecord } from '../domain/billing.models';

interface Envelope<T> { success: boolean; data: T }

@Injectable({ providedIn: 'root' })
export class PlatformBillingApi {
  private readonly http = inject(HttpClient);
  private readonly url = inject(API_CONFIG).apiBaseUrl + '/platform-billing/admin';

  overview(companyId?: number) {
    return this.get<BillingOverview>('overview', companyId ? { companyId } : {});
  }

  accounts(companyId?: number, search?: string) {
    return this.get<BillingAccount[]>('accounts', { ...(companyId ? { companyId } : {}), ...(search ? { search } : {}) });
  }

  records(kind: BillingKind, filters: BillingFilters, before?: BillingCursor) {
    const params: Record<string, string | number | boolean> = { limit: 25 };
    for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== '') params[key] = value;
    if (before) Object.assign(params, { beforeId: before.id, beforeDate: before.createdAt });
    return this.get<BillingPage>('records/' + kind, params);
  }

  detail(companyId: number, kind: BillingKind, id: string) {
    return this.get<BillingRecord>('tenants/' + companyId + '/records/' + kind + '/' + encodeURIComponent(id));
  }

  pdf(record: BillingRecord) {
    return this.http.get(this.url + '/tenants/' + record.companyId + '/documents/' + record.kind + '/' + encodeURIComponent(record.id) + '/pdf',
      { responseType: 'blob' });
  }

  apply(companyId: number, method: 'POST' | 'PUT', path: string, body: Record<string, unknown>) {
    return this.http.request<Envelope<unknown>>(method, this.url + '/tenants/' + companyId + '/' + path, { body }).pipe(map(response => response.data));
  }

  private get<T>(path: string, params: Record<string, string | number | boolean> = {}) {
    return this.http.get<Envelope<T>>(this.url + '/' + path, { params }).pipe(map(response => response.data));
  }
}
