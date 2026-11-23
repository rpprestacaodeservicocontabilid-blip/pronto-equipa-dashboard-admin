import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, map, Observable, of, Subject, switchMap } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { PageBreadcrumbComponent } from '../../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { AiPage, AiRow, AiValue } from '../domain/ai-assistant.models';
import { AiSection } from '../domain/ai-assistant.navigation';
import { AiAssistantApi } from '../infrastructure/ai-assistant-api';
import { AiCompanyPickerComponent } from './ai-company-picker.component';
import { AiEditorComponent, AiEditKind } from './ai-editor.component';

interface Scope { companyId: number | null; period: string }
type WorkspaceData = AiPage<AiRow> | Record<string, number | null> | null;
const metrics = [
  ['activeProviders', 'Active providers'], ['activeModels', 'Active models'],
  ['publishedPrompts', 'Published prompts'], ['activeTools', 'Registered active tools'],
  ['activeConversations', 'Active conversations'], ['processed', 'Completed requests'],
  ['failed', 'Failed requests'], ['tokens', 'Tokens used'], ['tools', 'Tool executions'],
  ['approvals', 'Pending approvals'], ['incidents', 'Safety incidents'], ['averageLatencyMs', 'Average latency (ms)'],
] as const;
const periodPattern = /^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/;
const currentPeriod = () => new Date(Date.now() + 3600000).toISOString().slice(0, 7);

@Component({
  selector: 'app-ai-assistant-workspace',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, RouterLink, ComponentCardComponent, PageBreadcrumbComponent, AiCompanyPickerComponent, AiEditorComponent],
  templateUrl: './ai-assistant-workspace.component.html',
  styleUrl: './ai-assistant.css',
})
export class AiAssistantWorkspaceComponent implements OnInit {
  private readonly api = inject(AiAssistantApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  protected readonly section = this.route.snapshot.data['section'] as AiSection;
  protected readonly metrics = metrics;
  protected readonly page = signal<AiPage<AiRow> | null>(null);
  protected readonly dashboard = signal<Record<string, number | null>>({});
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly editor = signal<{ kind: AiEditKind; row?: AiRow } | null>(null);
  protected readonly scope = signal<Scope>({ companyId: null, period: currentPeriod() });
  private readonly requests = new Subject<number>();

  ngOnInit() {
    this.requests.pipe(
      switchMap(page => {
        const { companyId, period } = this.scope();
        this.page.set(null);
        this.dashboard.set({});
        this.error.set('');
        if (this.section.scope === 'company' && companyId === null) {
          return of({ data: null, error: '' });
        }
        this.busy.set(true);
        const request: Observable<WorkspaceData> = this.section.path === 'overview'
          ? this.api.dashboard(companyId, period)
          : this.api.list(this.section, page, companyId, period);
        return request.pipe(
          map(data => ({ data, error: '' })),
          catchError(error => of({ data: null, error: apiErrorMessage(error) })),
        );
      }),
      takeUntilDestroyed(this.destroy),
    ).subscribe(({ data, error }) => {
      if (data) {
        if (this.section.path === 'overview') this.dashboard.set(data as Record<string, number | null>);
        else this.page.set(data as AiPage<AiRow>);
      }
      this.error.set(error);
      this.busy.set(false);
    });
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroy)).subscribe(params => {
      this.editor.set(null);
      const raw = this.section.scope ? Number(params.get('companyId')) : 0;
      const period = params.get('period') ?? '';
      this.scope.set({
        companyId: Number.isInteger(raw) && raw > 0 && raw <= 2147483647 ? raw : null,
        period: periodPattern.test(period) ? period : currentPeriod(),
      });
      this.reload();
    });
  }

  protected chooseCompany(companyId: number | null) {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { companyId }, queryParamsHandling: 'merge' });
  }

  protected choosePeriod(period: string) {
    if (periodPattern.test(period)) {
      void this.router.navigate([], { relativeTo: this.route, queryParams: { period }, queryParamsHandling: 'merge' });
    }
  }

  protected reload(page = 1) { this.requests.next(page); }

  protected open(kind: AiEditKind, row?: AiRow) {
    this.notice.set('');
    this.editor.set({ kind, row });
  }

  protected saved(message: string) {
    this.editor.set(null);
    this.notice.set(message);
    this.reload(1);
  }

  protected text(value: AiValue | undefined): string {
    return value === undefined || value === null || value === '' ? '—'
      : Array.isArray(value) ? value.join(', ') || '—' : String(value);
  }

  protected status(value: AiValue | undefined) {
    return this.text(value).replaceAll('_', ' ').toLowerCase();
  }
}
