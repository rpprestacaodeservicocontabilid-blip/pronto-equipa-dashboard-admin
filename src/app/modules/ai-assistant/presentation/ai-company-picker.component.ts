import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { AiCompany, AiPage } from '../domain/ai-assistant.models';
import { AiAssistantApi } from '../infrastructure/ai-assistant-api';

@Component({
  selector: 'app-ai-company-picker',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './ai-company-picker.component.html',
  styleUrl: './ai-assistant.css',
})
export class AiCompanyPickerComponent {
  private readonly api = inject(AiAssistantApi);
  @Input() companyId: number | null = null;
  @Input() optional = false;
  @Output() companyIdChange = new EventEmitter<number | null>();
  protected readonly open = signal(false);
  protected readonly selection = signal<AiCompany | null>(null);
  protected readonly result = signal<AiPage<AiCompany> | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected search = '';
  private applied = '';
  private request = 0;

  protected toggle() {
    this.open.update(value => !value);
    if (this.open() && !this.result()) void this.load();
  }

  protected async load(page = 1, search = false) {
    if (search) this.applied = this.search.trim();
    const request = ++this.request;
    this.busy.set(true);
    this.error.set('');
    try {
      const result = await firstValueFrom(this.api.companies(this.applied, page));
      if (request === this.request) this.result.set(result);
    } catch (error) {
      if (request === this.request) {
        this.result.set(null);
        this.error.set(apiErrorMessage(error));
      }
    } finally {
      if (request === this.request) this.busy.set(false);
    }
  }

  protected choose(company: AiCompany | null) {
    this.selection.set(company);
    this.companyIdChange.emit(company?.id ?? null);
    this.open.set(false);
  }
}
