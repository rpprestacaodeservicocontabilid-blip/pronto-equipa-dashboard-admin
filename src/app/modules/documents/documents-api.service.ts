import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { API_CONFIG } from '../../core/api/api-config';
import { companyScope } from '../../core/api/company-workspace-api';

@Injectable({ providedIn: 'root' })
export class DocumentsApi {
  private readonly http = inject(HttpClient);
  private readonly origin = inject(API_CONFIG).apiBaseUrl;
  get<T>(company: number, path: string, params: Record<string, string | number> = {}) {
    return this.http.get<{ data: T }>(this.origin + '/documents' + path, { params, ...companyScope(company) }).pipe(map(result => result.data));
  }
  write<T>(company: number, path: string, body: object | null, method: 'POST' | 'PATCH' | 'PUT' | 'DELETE' = 'POST') {
    return this.http.request<{ data: T }>(method, this.origin + '/documents' + path, { body, ...companyScope(company) }).pipe(map(result => result.data));
  }
  oversight(company: number) {
    return this.http.get<{ data: Oversight }>(this.origin + '/platform/documents/' + company + '/overview').pipe(map(result => result.data));
  }
}
export interface Storage { usedBytes: number; reservedBytes: number; quotaBytes: number }
export interface Oversight { company: { id: number; name: string }; byStatus: Record<string, number>; storage: Storage | null }
export function storageUrl(value: string) {
  const url = new URL(value);
  if (url.username || url.password || !['http:', 'https:'].includes(url.protocol)) throw new Error('Invalid storage link.');
  return url.href;
}
