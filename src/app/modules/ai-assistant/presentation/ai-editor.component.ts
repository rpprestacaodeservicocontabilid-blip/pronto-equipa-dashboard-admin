import { Component, EventEmitter, inject, Input, OnInit, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom, Observable } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { AiEvaluationInput, AiIncidentStatus, AiModelInput, AiPrompt, AiPromptInput, AiProviderInput, AiRow } from '../domain/ai-assistant.models';
import { AiAssistantApi } from '../infrastructure/ai-assistant-api';

export type AiEditKind = 'provider' | 'model' | 'prompt' | 'sync' | 'disable' | 'evaluation' | 'incident';
const providerDefaults: AiProviderInput = { code: '', name: '', priority: 100, timeoutMs: 30000, status: 'ACTIVE' };
const modelDefaults: AiModelInput = {
  providerId: '', modelCode: '', displayName: '', status: 'ACTIVE', isDefault: false, currency: 'AOA',
  temperature: null, maxOutputTokens: null, inputPricePerMillion: 0, outputPricePerMillion: 0,
};

@Component({
  selector: 'app-ai-editor',
  standalone: true,
  imports: [FormsModule, ComponentCardComponent],
  templateUrl: './ai-editor.component.html',
  styleUrl: './ai-assistant.css',
})
export class AiEditorComponent implements OnInit {
  private readonly api = inject(AiAssistantApi);
  @Input({ required: true }) kind: AiEditKind = 'provider';
  @Input() row?: AiRow;
  @Input() companyId: number | null = null;
  @Output() saved = new EventEmitter<string>();
  @Output() closed = new EventEmitter<void>();
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly providers = signal<AiRow[]>([]);
  protected readonly preview = signal<AiPrompt | null>(null);
  protected provider = { ...providerDefaults };
  protected model = { ...modelDefaults };
  protected draft: AiPromptInput = { templateCode: 'AI_ASSISTANT_SYSTEM', content: '' };
  protected evaluation: AiEvaluationInput = { code: '', cases: [{ name: '', expectedBehaviour: '' }] };
  protected incidentStatus: AiIncidentStatus = 'ACKNOWLEDGED';
  protected reason = '';
  protected confirmed = false;

  ngOnInit() {
    const row = this.row;
    if (this.kind === 'provider' && row) {
      this.provider = {
        code: String(row['code']), name: String(row['name']), status: String(row['status']),
        priority: Number(row['priority']), timeoutMs: Number(row['timeoutMs']),
      };
    }
    if (this.kind === 'model') {
      if (row) {
        this.model = {
          providerId: String(row['providerId']), modelCode: String(row['modelCode']),
          displayName: String(row['displayName']), status: String(row['status']), isDefault: Boolean(row['isDefault']),
          currency: String(row['currency']), temperature: row['temperature'] == null ? null : Number(row['temperature']),
          maxOutputTokens: row['maxOutputTokens'] == null ? null : Number(row['maxOutputTokens']),
          inputPricePerMillion: Number(row['inputPricePerMillion']), outputPricePerMillion: Number(row['outputPricePerMillion']),
        };
      }
      void this.load();
    }
    if (this.kind === 'prompt' && this.row) void this.load();
    if (this.kind === 'incident' && row?.['status'] === 'ACKNOWLEDGED') this.incidentStatus = 'RESOLVED';
  }

  protected get title() {
    switch (this.kind) {
      case 'provider': return this.row ? 'Edit provider' : 'Add provider';
      case 'model': return this.row ? 'Edit model configuration' : 'Configure model';
      case 'prompt': return this.row ? 'Review prompt version' : 'New prompt draft';
      case 'sync': return 'Sync tool catalogue';
      case 'disable': return 'Disable ' + this.row?.['name'];
      case 'evaluation': return 'New evaluation version';
      case 'incident': return 'Update safety incident';
    }
  }

  protected get canPublish() {
    const status = this.preview()?.status;
    return status === 'DRAFT' || status === 'TESTED';
  }

  protected get providerAvailable() {
    return this.providers().some(provider => provider.id === this.model.providerId);
  }

  protected async load() {
    this.busy.set(true);
    this.error.set('');
    try {
      if (this.kind === 'model') this.providers.set(await firstValueFrom(this.api.activeProviders()));
      if (this.kind === 'prompt' && this.row) this.preview.set(await firstValueFrom(this.api.prompt(String(this.row.id))));
    } catch (error) { this.error.set(apiErrorMessage(error)); }
    finally { this.busy.set(false); }
  }

  protected async submit() {
    if (this.busy()) return;
    const id = this.row ? String(this.row.id) : undefined;
    let request: Observable<unknown>;
    let notice: string;
    switch (this.kind) {
      case 'provider':
        request = this.api.saveProvider({ ...this.provider, code: this.provider.code.trim() }, id);
        notice = 'Provider saved.';
        break;
      case 'model':
        request = this.api.saveModel({ ...this.model, currency: this.model.currency.trim().toUpperCase() }, id);
        notice = 'Model configuration saved.';
        break;
      case 'prompt':
        if (id && (!this.confirmed || !this.canPublish)) return;
        request = id ? this.api.publishPrompt(id) : this.api.createPrompt({ ...this.draft, templateCode: this.draft.templateCode.trim().toUpperCase() });
        notice = id ? 'Prompt version published.' : 'Prompt draft saved.';
        break;
      case 'sync':
        request = this.api.syncTools();
        notice = 'Tool catalogue synchronized.';
        break;
      case 'disable':
        if (!id || this.reason.trim().length < 5) return;
        request = this.api.disableTool(id, this.reason.trim());
        notice = 'Tool disabled.';
        break;
      case 'evaluation':
        request = this.api.createEvaluation({ ...this.evaluation, code: this.evaluation.code.trim().toUpperCase() });
        notice = 'Evaluation version saved.';
        break;
      case 'incident':
        if (!id || !this.companyId || this.reason.trim().length < 5) return;
        request = this.api.updateIncident(id, this.companyId, {
          expected: String(this.row?.['status']), status: this.incidentStatus, reason: this.reason.trim(),
        });
        notice = 'Safety incident updated.';
        break;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      await firstValueFrom(request);
      this.saved.emit(notice);
    } catch (error) { this.error.set(apiErrorMessage(error)); }
    finally { this.busy.set(false); }
  }

}
