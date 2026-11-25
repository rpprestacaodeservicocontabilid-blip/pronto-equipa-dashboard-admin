import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { API_CONFIG } from '../../../core/api/api-config';
import { companyScope } from '../../../core/api/company-workspace-api';
import { InboxFilter, InboxItem, NotificationCompany, NotificationPage, NotificationPreference, NotificationProviderView,
  NotificationRecord, NotificationReport, NotificationPolicy, NotificationSettings, TemplatePreview } from '../domain/notifications.models';

interface Envelope<T> { data: T }
@Injectable({ providedIn: 'root' })
export class NotificationsApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_CONFIG).apiBaseUrl;
  private readonly admin = this.base + '/platform/notifications/';

  companies(search: string, page: number) { return this.get<NotificationPage<NotificationCompany>>(this.admin + 'companies', { search, page, limit: 15 }); }
  list(company: number | null, path: string, page: number, status: string, channel: string) {
    return this.get<NotificationPage<NotificationRecord>>(this.adminPath(company, path), { page, limit: 25, status, channel });
  }
  templates(company: number | null, page: number) {
    return this.get<NotificationPage<NotificationRecord>>(this.adminPath(company, 'templates'), { page, limit: 100, status: 'PUBLISHED' });
  }
  records(company: number | null, path: string) { return this.get<NotificationRecord[]>(this.adminPath(company, path)); }
  report(company: number | null, path: string) { return this.get<NotificationReport>(this.adminPath(company, path)); }
  providers() { return this.get<NotificationProviderView[]>(this.admin + 'providers'); }
  policy(company: number | null) { return this.get<NotificationPolicy[]>(this.adminPath(company, 'preferences-policy')); }
  settings() { return this.get<NotificationSettings>(this.admin + 'settings'); }
  write<T = NotificationRecord>(company: number | null, method: 'POST' | 'PATCH' | 'PUT', path: string, body: object) {
    return this.http.request<Envelope<T>>(method, this.adminPath(company, path), { body }).pipe(map(result => result.data));
  }
  preview(company: number | null, id: string, variables: Record<string, string>) {
    return this.write<TemplatePreview>(company, 'POST', 'templates/' + encodeURIComponent(id) + '/preview', { variables });
  }
  inbox(company: number | null, page: number, state: InboxFilter = '') {
    return this.get<InboxItem[]>(this.personalPath(company), { page, state }, company);
  }
  item(company: number | null, id: string) { return this.get<InboxItem>(this.personalPath(company, '/' + encodeURIComponent(id)), {}, company); }
  unread(company: number | null) { return this.get<{ count: number }>(this.personalPath(company, '/unread-count'), {}, company); }
  preferences(company: number | null) { return this.get<Array<{ id: string; data: NotificationPreference }>>(this.personalPath(company, '/preferences'), {}, company); }
  preferenceHistory(company: number | null) {
    return this.get<NotificationRecord[]>(this.personalPath(company, '/preferences/history'), {}, company);
  }
  savePreference(company: number | null, input: NotificationPreference) {
    return this.http.put<Envelope<NotificationPreference>>(this.personalPath(company, '/preferences'), input, company ? companyScope(company) : {})
      .pipe(map(result => result.data));
  }
  mark(company: number | null, action: 'read' | 'archive' | 'read-all', id = '') {
    const path = action === 'read-all' ? '/read-all' : '/' + encodeURIComponent(id) + '/' + action;
    return this.http.post<Envelope<unknown>>(this.personalPath(company, path), {}, company ? companyScope(company) : {});
  }
  private adminPath(company: number | null, path: string) { return this.admin + (company ? 'companies/' + company + '/' : '') + path; }
  private personalPath(company: number | null, suffix = '') { return this.base + (company ? '/notifications/me' : '/notifications/personal/me') + suffix; }
  private get<T>(url: string, query: Record<string, string | number> = {}, company: number | null = null) {
    const params = Object.fromEntries(Object.entries(query).filter(([, value]) => value !== ''));
    return this.http.get<Envelope<T>>(url, { params, ...(company ? companyScope(company) : {}) }).pipe(map(result => result.data));
  }
}
