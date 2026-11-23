import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, shareReplay } from 'rxjs';
import { API_CONFIG } from '../../../core/api/api-config';
import { AuditEntry, Company, Definition, Execution, ExecutionResult, Export, Format, Page, Policy, Preview, ReportPolicy, ReportRequest, Schedule, ScheduleInput, Template } from '../domain/platform-reports.models';

interface Envelope<T> { data: T }

@Injectable({ providedIn: 'root' })
export class PlatformReportsApi {
  private readonly http = inject(HttpClient);
  private readonly url = inject(API_CONFIG).apiBaseUrl + '/platform/reports/';
  readonly catalog = this.get<Definition[]>('catalog').pipe(shareReplay({ bufferSize: 1, refCount: false }));

  companies(search = '', page = 1) { return this.get<Page<Company>>('companies', { search, page, limit: 50 }); }
  preview(input: ReportRequest, compare: boolean) { return this.post<Preview>('preview', { ...input, compare }); }
  run(input: ReportRequest, operationKey: string) { return this.post<Execution>('executions', { ...input, operationKey }); }
  execution(id: string) { return this.get<ExecutionResult>('executions/' + encodeURIComponent(id)); }
  retry(id: string) { return this.post<Execution>('executions/' + encodeURIComponent(id) + '/retry', {}); }
  makeExport(id: string, format: Format) { return this.post<Export>('executions/' + encodeURIComponent(id) + '/exports', { format }); }
  download(id: string) { return this.http.get(this.url + 'exports/' + encodeURIComponent(id) + '/download', { responseType: 'blob' }); }
  saveTemplate(input: ReportRequest & { title: string; previousId?: string }) { return this.post<Template>('templates', input); }
  schedule(input: ScheduleInput) { return this.post<Schedule>('schedules', input); }
  editSchedule(id: string, input: ScheduleInput) {
    return this.http.patch<Envelope<Schedule>>(this.url + 'schedules/' + encodeURIComponent(id), input).pipe(map(response => response.data));
  }
  setSchedule(id: string, status: 'ACTIVE' | 'PAUSED') {
    return this.post<Schedule>('schedules/' + encodeURIComponent(id) + '/status', { status });
  }
  policy() { return this.get<ReportPolicy>('policy'); }
  publish(policy: Omit<Policy, 'version'>, expected: number, reason: string) { return this.post<Policy>('policy', { ...policy, expected, reason }); }
  list(view: 'executions' | 'exports' | 'templates' | 'schedules' | 'audit', page: number) {
    return this.get<Page<Execution | Export | Template | Schedule | AuditEntry>>(view, { page, limit: 25 });
  }
  private get<T>(path: string, query: object = {}) {
    const params = Object.fromEntries(Object.entries(query).filter(([, value]) => value !== ''));
    return this.http.get<Envelope<T>>(this.url + path, { params }).pipe(map(response => response.data));
  }
  private post<T>(path: string, body: object) {
    return this.http.post<Envelope<T>>(this.url + path, body).pipe(map(response => response.data));
  }
}
