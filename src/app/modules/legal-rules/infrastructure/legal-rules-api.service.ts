import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { EMPTY, Observable, expand, map, reduce } from 'rxjs';
import { API_CONFIG } from '../../../core/api/api-config';
import { AuditPage, ImpactInput, ImpactResult, LegalAction, LegalInput, LegalPage, LegalPatch, LegalSource, LegalStatus, LegalVersion, SourceInput } from '../domain/legal.models';

interface Envelope<T> { data: T }

function collect<T>(request: (page: number) => Observable<LegalPage<T>>) {
  return request(1).pipe(
    expand(current => current.items.length && current.page * current.limit < current.total ? request(current.page + 1) : EMPTY, 1),
    reduce((items, page) => { items.push(...page.items); return items; }, [] as T[]),
  );
}

@Injectable({ providedIn: 'root' })
export class LegalRulesApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_CONFIG).apiBaseUrl;
  private readonly url = this.base + '/legal-rules';

  versions(status?: LegalStatus) {
    return collect(page => this.http.get<Envelope<LegalPage<LegalVersion>>>(this.url, {
      params: { page, limit: 100, ...(status ? { status } : {}) },
    }).pipe(map(response => response.data)));
  }

  version(id: string) {
    return this.http.get<Envelope<LegalVersion>>(this.url + '/' + encodeURIComponent(id)).pipe(map(response => response.data));
  }

  create(input: LegalInput) {
    return this.http.post<Envelope<LegalVersion>>(this.url, input).pipe(map(response => response.data));
  }

  update(id: string, input: LegalPatch) {
    return this.http.patch<Envelope<LegalVersion>>(this.url + '/' + encodeURIComponent(id), input).pipe(map(response => response.data));
  }

  transition(id: string, action: LegalAction, expectedUpdatedAt: string, reason?: string) {
    return this.http.post<Envelope<LegalVersion>>(this.url + '/' + encodeURIComponent(id) + '/' + action, {
      expectedUpdatedAt, ...(reason ? { reason } : {}),
    }).pipe(map(response => response.data));
  }

  sources() {
    return collect(page => this.http.get<Envelope<LegalPage<LegalSource>>>(this.url + '/sources', {
      params: { page, limit: 100 },
    }).pipe(map(response => response.data)));
  }

  sourceCount() {
    return this.http.get<Envelope<LegalPage<LegalSource>>>(this.url + '/sources', {
      params: { page: 1, limit: 1 },
    }).pipe(map(response => response.data.total));
  }

  registerSource(input: SourceInput) {
    return this.http.post<Envelope<LegalSource>>(this.url + '/sources', input).pipe(map(response => response.data));
  }

  impact(input: ImpactInput) {
    return this.http.post<Envelope<ImpactResult>>(this.url + '/impact', input).pipe(map(response => response.data));
  }

  audit(purpose: string, cursor?: number, throughSequence?: number) {
    return this.http.get<Envelope<AuditPage>>(this.base + '/admin/audit/records', {
      headers: { 'X-Audit-Purpose': purpose },
      params: { module: 'legal-rules', limit: 30, ...(cursor != null ? { cursor } : {}), ...(throughSequence != null ? { throughSequence } : {}) },
    }).pipe(map(response => response.data));
  }
}
