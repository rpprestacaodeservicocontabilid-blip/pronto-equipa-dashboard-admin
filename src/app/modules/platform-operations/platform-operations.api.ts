import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { API_CONFIG } from '../../core/api/api-config';

export type Health = 'up' | 'degraded' | 'down';
export interface OperationsOverview {
  observedAt: string;
  lifecycle: string;
  ready: boolean;
  health: Health | null;
  checks: { name: string; status: Health; critical: boolean }[];
  process: { uptimeSeconds: number; rssBytes: number; heapUsedBytes: number; heapTotalBytes: number };
}
export interface QueueStatus {
  key: string;
  name: string | null;
  status: 'ACTIVE' | 'PAUSED' | 'NOT_STARTED' | 'UNAVAILABLE';
  localWorker: 'RUNNING' | 'PAUSED' | 'STOPPED' | 'NOT_STARTED';
  counts: Record<'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'paused', number> | null;
}
interface ScheduleStatus {
  key: string;
  status: 'ACTIVE' | 'NOT_STARTED';
  timezone: string;
  nextRunAt: string | null;
}
interface OperationsResponses {
  overview: OperationsOverview;
  queues: { observedAt: string; queues: QueueStatus[] };
  'scheduled-jobs': { observedAt: string; schedules: ScheduleStatus[] };
}
type OperationsEndpoint = keyof OperationsResponses;
export type OperationsSnapshot = { [E in OperationsEndpoint]: { endpoint: E; data: OperationsResponses[E] } }[OperationsEndpoint];

@Injectable({ providedIn: 'root' })
export class PlatformOperationsApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_CONFIG).apiBaseUrl + '/platform-operations/';

  snapshot(endpoint: OperationsEndpoint) {
    switch (endpoint) {
      case 'overview': return this.read(endpoint).pipe(map(data => ({ endpoint, data })));
      case 'queues': return this.read(endpoint).pipe(map(data => ({ endpoint, data })));
      case 'scheduled-jobs': return this.read(endpoint).pipe(map(data => ({ endpoint, data })));
    }
  }
  private read<E extends OperationsEndpoint>(endpoint: E) {
    return this.http.get<{ data: OperationsResponses[E] }>(this.base + endpoint).pipe(map(reply => reply.data));
  }
}
