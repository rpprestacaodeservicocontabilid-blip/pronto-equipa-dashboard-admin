import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { API_CONFIG } from './api-config';

export interface CompanyMembership {
  id: number;
  name: string;
  status: string;
}

export interface CompanyWorkspace {
  company: CompanyMembership;
  permissions: string[];
}

export interface ApiPage<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export function companyScope(companyId: number) {
  return { headers: { 'X-Company-Id': String(companyId) } };
}

@Injectable({ providedIn: 'root' })
export class CompanyWorkspaceApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(API_CONFIG);

  companies() {
    return this.http.get<{ data: CompanyMembership[] }>(this.config.apiBaseUrl + '/companies')
      .pipe(map(result => result.data));
  }

  context(companyId: number) {
    return this.http.get<{ data: CompanyWorkspace }>(this.config.apiBaseUrl + '/company/context', companyScope(companyId))
      .pipe(map(result => result.data));
  }
}
