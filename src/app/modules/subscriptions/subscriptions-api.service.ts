import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { API_CONFIG } from '../../core/api/api-config';

@Injectable({ providedIn: 'root' })
export class SubscriptionsApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_CONFIG).apiBaseUrl + '/subscriptions/admin/';
  get<T>(path: string, params: Record<string, string | number> = {}) {
    return this.http.get<{ data: T }>(this.base + path, { params }).pipe(map(response => response.data));
  }
  save(path: string, body: object, method: 'POST' | 'PUT' | 'PATCH' = 'POST') {
    return this.http.request<{ data: unknown }>(method, this.base + path, { body }).pipe(map(response => response.data));
  }
}
