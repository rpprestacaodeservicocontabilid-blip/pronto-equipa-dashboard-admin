import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { API_CONFIG } from '../../../core/api/api-config';
import {
  Breakdown, Incident, PaymentDetail, PaymentDirectory, PaymentFilters,
  PaymentOverview, PaymentPage, PaymentReport, Provider,
} from '../domain/payment.models';

interface Envelope<T> { data: T }
type Params = Record<string, string | number>;

function filterParams(filters: PaymentFilters): Params {
  return {
    ...(filters.companyId !== undefined ? { companyId: filters.companyId } : {}),
    ...(filters.from ? { from: filters.from } : {}),
    ...(filters.to ? { to: filters.to } : {}),
    ...(filters.providerId ? { providerId: filters.providerId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
  };
}

@Injectable({ providedIn: 'root' })
export class PaymentsApi {
  private readonly http = inject(HttpClient);
  private readonly url = inject(API_CONFIG).apiBaseUrl + '/platform/payments';

  overview(filters: PaymentFilters) {
    return this.get<PaymentOverview>('overview', filterParams(filters));
  }

  providers() {
    return this.get<Provider[]>('providers');
  }

  list(view: PaymentDirectory, filters: PaymentFilters, page: number, incident?: Incident, purpose?: string) {
    return this.get<PaymentPage>(view, { ...filterParams(filters), page, limit: 25, ...(incident ? { incident } : {}) },
      view === 'audit' ? purpose : undefined);
  }

  detail(view: PaymentDirectory, id: string | number, purpose?: string) {
    return this.get<PaymentDetail>(view + '/' + encodeURIComponent(id), {}, view === 'audit' ? purpose : undefined);
  }

  report(filters: PaymentFilters, page: number, breakdown: Breakdown) {
    return this.get<PaymentReport>('reports', { ...filterParams(filters), page, limit: 25, breakdown });
  }

  private get<T>(path: string, params: Params = {}, purpose?: string) {
    return this.http.get<Envelope<T>>(this.url + '/' + path, {
      params, ...(purpose ? { headers: { 'X-Audit-Purpose': purpose } } : {}),
    }).pipe(map(response => response.data));
  }
}
