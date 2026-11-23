import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { API_CONFIG } from '../../../core/api/api-config';
import { SupportCompany, SupportDashboard, SupportMessage, SupportPage, SupportRow, SupportTicket, TicketQuery } from '../domain/support.models';

interface Envelope<T> { data: T }
@Injectable({ providedIn: 'root' })
export class SupportApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_CONFIG).apiBaseUrl + '/platform/support/';

  companies(search: string, page: number) { return this.http.get<SupportPage<SupportCompany>>(this.base + 'companies', { params: { search, page, limit: 15 } }); }
  tickets(company: number, filters: TicketQuery, page: number) {
    return this.http.get<SupportPage<SupportTicket>>(this.url(company, 'tickets'), { params: this.params({ ...filters, page, limit: 25 }) });
  }
  slaTickets(company: number, path: string) { return this.get<SupportTicket[]>(company, path); }
  ticket(company: number, id: string) { return this.get<SupportTicket>(company, 'tickets/' + encodeURIComponent(id)); }
  messages(company: number, id: string) { return this.get<SupportMessage[]>(company, 'tickets/' + encodeURIComponent(id) + '/messages'); }
  history(company: number, id: string) { return this.get<SupportRow[]>(company, 'tickets/' + encodeURIComponent(id) + '/history'); }
  directory(company: number | null, path: string, q = '') { return this.get<SupportRow[]>(company, path, this.params({ q })); }
  dashboard(company: number, path: string) { return this.get<SupportDashboard>(company, path); }
  request(company: number | null, method: 'POST' | 'PATCH', path: string, body: object) {
    return this.http.request<Envelope<SupportRow>>(method, this.url(company, path), { body }).pipe(map(response => response.data));
  }
  private get<T>(company: number | null, path: string, params: Record<string, string | number> = {}) {
    return this.http.get<Envelope<T>>(this.url(company, path), { params }).pipe(map(response => response.data));
  }
  private url(company: number | null, path: string) { return this.base + (company === null ? '' : 'companies/' + company + '/') + path; }
  private params(value: object) {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item != null && item !== ''));
  }
}
