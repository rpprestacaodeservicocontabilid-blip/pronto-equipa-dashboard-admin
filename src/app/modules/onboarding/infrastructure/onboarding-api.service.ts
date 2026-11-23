import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { API_CONFIG } from '../../../core/api/api-config';
import { Application, CompanyInput, OnboardingEvent, OnboardingPolicy, Overview, Page, PolicyResponse, Resource, ResourceKind, Workspace } from '../domain/onboarding.models';

type Query = Record<string, string | number | undefined>;
interface Envelope<T> { data: T }

@Injectable({ providedIn: 'root' })
export class OnboardingApi {
  private readonly http = inject(HttpClient);
  private readonly url = inject(API_CONFIG).apiBaseUrl + '/onboarding/admin/';

  overview(params: Query) { return this.get<Overview>('overview', params); }
  applications(params: Query) { return this.get<Page<Application>>('directory', params); }
  workspace(id: string) { return this.get<Workspace>('applications/' + id + '/workspace'); }
  resources(kind: ResourceKind, params: Query) { return this.get<Page<Resource>>('resources/' + kind, params); }
  events(communications: boolean, params: Query) {
    return this.get<Page<OnboardingEvent>>(communications ? 'communications' : 'audit', params);
  }
  policy() { return this.get<PolicyResponse>('policy'); }
  publish(policy: Omit<OnboardingPolicy, 'version'>, expectedVersion: number, reason: string) {
    return this.post<OnboardingPolicy>('policy', { ...policy, expectedVersion, reason });
  }
  create(input: { operationKey: string; mode: string; source: string; company: CompanyInput }) {
    return this.post<{ id: string }>('assisted', input);
  }
  invite(id: string, email: string) {
    return this.post<{ token: string; expiresInSeconds: number }>('applications/' + id + '/invitations', { email });
  }
  documentUrl(id: string, documentId: string) {
    return this.get<{ url: string }>('applications/' + id + '/documents/' + documentId + '/download');
  }
  action(id: string, action: string, body: Record<string, unknown>) {
    return this.post<unknown>('applications/' + id + '/' + action, body);
  }

  private get<T>(path: string, query: Query = {}) {
    const params = Object.fromEntries(Object.entries(query).flatMap(([key, value]) =>
      value === '' || value === undefined ? [] : [[key, value]]));
    return this.http.get<Envelope<T>>(this.url + path, { params }).pipe(map(result => result.data));
  }
  private post<T>(path: string, body: object) {
    return this.http.post<Envelope<T>>(this.url + path, body).pipe(map(result => result.data));
  }
}
