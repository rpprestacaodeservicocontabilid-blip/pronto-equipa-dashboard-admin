import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { API_CONFIG } from '../../../core/api/api-config';
import { AiCompany, AiEvaluationInput, AiIncidentStatus, AiModelInput, AiPage, AiPrompt, AiPromptInput, AiProviderInput, AiRow } from '../domain/ai-assistant.models';
import { AiSection } from '../domain/ai-assistant.navigation';

interface Envelope<T> { data: T }

@Injectable({ providedIn: 'root' })
export class AiAssistantApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_CONFIG).apiBaseUrl + '/ai-assistant/admin/';

  companies(search: string, page: number) {
    return this.get<AiPage<AiCompany>>('companies', { search, page, limit: 15 });
  }

  dashboard(companyId: number | null, period: string) {
    return this.get<Record<string, number | null>>('dashboard', this.filters(companyId, period));
  }

  list(section: AiSection, page: number, companyId: number | null, period: string) {
    return this.get<AiPage<AiRow>>(section.endpoint, {
      page, limit: 25, ...this.filters(section.scope ? companyId : null, section.month ? period : ''),
    });
  }

  activeProviders() {
    return this.get<AiPage<AiRow>>('providers', { page: 1, limit: 100 }).pipe(map(page => page.items));
  }

  saveProvider(input: AiProviderInput, id?: string) { return this.save('providers', input, id); }
  saveModel(input: AiModelInput, id?: string) { return this.save('models', input, id); }
  prompt(id: string) { return this.get<AiPrompt>('prompts/' + encodeURIComponent(id)); }
  createPrompt(input: AiPromptInput) { return this.save('prompts', input); }
  publishPrompt(id: string) { return this.save('prompts/' + encodeURIComponent(id) + '/publish', {}); }
  syncTools() { return this.save('tools/sync', {}); }
  disableTool(id: string, reason: string) { return this.save('tools/' + encodeURIComponent(id) + '/disable', { reason }); }
  createEvaluation(input: AiEvaluationInput) { return this.save('evaluations', input); }
  updateIncident(id: string, companyId: number, input: { expected: string; status: AiIncidentStatus; reason: string }) {
    return this.http.patch<Envelope<unknown>>(this.base + 'safety-incidents/' + encodeURIComponent(id), input, {
      params: { companyId },
    }).pipe(map(response => response.data));
  }

  private filters(companyId: number | null, period: string) {
    return { ...(companyId ? { companyId } : {}), ...(period ? { period } : {}) };
  }

  private get<T>(path: string, params: Record<string, string | number> = {}) {
    return this.http.get<Envelope<T>>(this.base + path, { params }).pipe(map(response => response.data));
  }

  private save(path: string, input: object, id?: string) {
    const request = id
      ? this.http.patch<Envelope<unknown>>(this.base + path + '/' + encodeURIComponent(id), input)
      : this.http.post<Envelope<unknown>>(this.base + path, input);
    return request.pipe(map(response => response.data));
  }
}
