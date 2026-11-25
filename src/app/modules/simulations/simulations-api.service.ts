import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { API_CONFIG } from '../../core/api/api-config';
import { companyScope } from '../../core/api/company-workspace-api';
import type { Oversight } from './simulations.models';

@Injectable({ providedIn: 'root' })
export class SimulationsApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_CONFIG).apiBaseUrl;

  get<T>(company: number, path: string, params: Record<string, string | number> = {}) {
    return this.http.get<{ data: T }>(this.base + '/simulations' + path, { params, ...companyScope(company) })
      .pipe(map(response => response.data));
  }

  write<T>(company: number, path: string, body: object = {}, method: 'POST' | 'PATCH' = 'POST') {
    return this.http.request<{ data: T }>(method, this.base + '/simulations' + path, { body, ...companyScope(company) })
      .pipe(map(response => response.data));
  }

  download(company: number, id: string) {
    return this.http.get(this.base + '/simulations/exports/' + id + '/download',
      { responseType: 'blob', ...companyScope(company) });
  }

  oversight(company: number) {
    return this.http.get<{ data: Oversight }>(this.base + '/platform/simulations/' + company + '/overview')
      .pipe(map(response => response.data));
  }
}
