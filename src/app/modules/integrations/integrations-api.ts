import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { API_CONFIG } from '../../core/api/api-config';
import { IntegrationSource } from './integrations.navigation';

export type ProviderState = 'REGISTERED' | 'CONFIGURED' | 'NOT_CONFIGURED' | 'ACTIVE' | 'DISABLED' | 'UNKNOWN';
export interface IntegrationProvider {
  id: string;
  name: string;
  type: string;
  state: ProviderState;
  capabilities?: string[];
}
export type IntegrationInventory =
  | { source: IntegrationSource; status: 'AVAILABLE'; providers: IntegrationProvider[]; total: number; readDurationMs?: number }
  | { source: IntegrationSource; status: 'RESTRICTED' | 'UNAVAILABLE' };
export interface IntegrationCatalogue { observedAt: string; sources: IntegrationInventory[] }

@Injectable({ providedIn: 'root' })
export class IntegrationsApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(API_CONFIG);

  catalogue() {
    return this.http.get<{ data: IntegrationCatalogue }>(this.config.apiBaseUrl + '/integrations/admin/catalog')
      .pipe(map(reply => reply.data));
  }
}
