import { CurrencyPipe, DatePipe, DecimalPipe, JsonPipe } from '@angular/common';
import { Component, DestroyRef, NgZone, PendingTasks, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom, forkJoin, Observable, skip, takeUntil, timer } from 'rxjs';
import { apiErrorMessage } from '../../core/api/api-error';
import { CompanyWorkspace } from '../../core/api/company-workspace-api';
import { ComponentCardComponent } from '../../shared/components/common/component-card/component-card.component';
import { PageBreadcrumbComponent } from '../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { decimal, ScenarioEditorComponent, uuidPattern } from './scenario-editor.component';
import { SimulationsApi } from './simulations-api.service';
import { Comparison, Explanation, ExportFormat, ExportRecord, Progress, Projection, Proposal,
  ResultLine, Run, RunResults, Scenario, ScenarioDraft, Version } from './simulations.models';
import { canSimulate, permissions, scenarioTypes, SimulationSection } from './simulations.navigation';
import { firstSection, SimulationAccess } from './simulations.routes';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, CurrencyPipe, DatePipe, DecimalPipe, JsonPipe,
    ComponentCardComponent, PageBreadcrumbComponent, ScenarioEditorComponent],
  templateUrl: './simulation-workspace.component.html',
  styleUrl: './simulations.css',
})
export class SimulationWorkspaceComponent {
  private readonly api = inject(SimulationsApi);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy = inject(DestroyRef);
  private readonly zone = inject(NgZone);
  private readonly pending = inject(PendingTasks);
  private readonly executionKeys = new Map<string, string>();
  private generation = 0;

  protected readonly p = permissions;
  protected readonly types = scenarioTypes;
  protected readonly scenarioStates = ['DRAFT', 'READY', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED'];
  protected readonly runStates = ['PENDING', 'VALIDATING', 'PROCESSING', 'COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED', 'CANCELLED'];
  protected readonly context = signal<CompanyWorkspace | null>(null);
  protected readonly section = signal<SimulationSection | undefined>(undefined);
  protected readonly denied = signal('');
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly busy = signal(false);
  protected readonly scenarios = signal<Scenario[]>([]);
  protected readonly selectedScenario = signal<Scenario | null>(null);
  protected readonly versions = signal<Version[] | null>(null);
  protected readonly editing = signal(false);
  protected readonly runs = signal<Run[]>([]);
  protected readonly runIndicators = computed(() => {
    const rows = this.runs();
    return [
      { label: 'Listed executions', value: rows.length },
      { label: 'In progress', value: rows.filter(row => this.activeStatuses.includes(row.status)).length },
      { label: 'Completed', value: rows.filter(row => row.status === 'COMPLETED').length },
      { label: 'With failures', value: rows.filter(row => row.status === 'FAILED' || row.status === 'PARTIALLY_COMPLETED').length },
    ];
  });
  protected readonly results = signal<RunResults | null>(null);
  protected readonly progress = signal<Progress | null>(null);
  protected readonly explanation = signal<Explanation | null>(null);
  protected readonly comparisons = signal<Comparison | null>(null);
  protected readonly projections = signal<Projection[]>([]);
  protected readonly proposals = signal<Proposal[]>([]);
  protected readonly detail = signal<Proposal | null>(null);
  protected readonly exports = signal<ExportRecord[]>([]);

  protected status = '';
  protected scenarioFilter = '';
  protected runId = '';
  protected baseline = '';
  protected compareMode: 'scenario' | 'official' = 'scenario';
  protected projectionMonths = 12;
  protected changes: { month: number; salary: string; headcount: number }[] = [];
  protected reason = '';
  protected format: ExportFormat = 'CSV';
  protected readonly activeStatuses = ['PENDING', 'PROCESSING', 'VALIDATING'];

  constructor() {
    this.route.data.pipe(takeUntilDestroyed(this.destroy)).subscribe(data => {
      this.generation++;
      this.reset();
      const access = data['access'] as SimulationAccess;
      if ('error' in access) {
        this.denied.set(access.error);
        return;
      }
      this.context.set(access.context);
      const section = (data['section'] as SimulationSection | undefined) ?? firstSection(access.context.permissions);
      this.section.set(section);
      if (!section || !this.allowed(...section.grants)) {
        this.denied.set('You do not have permission to open this simulation workspace.');
        return;
      }
      const scenario = this.route.snapshot.queryParamMap.get('scenario');
      const run = this.route.snapshot.queryParamMap.get('run');
      this.scenarioFilter = scenario && uuidPattern.test(scenario) ? scenario : '';
      void this.perform(async id => {
        await this.refreshDirectory(id);
        if (section.view === 'runs' && run && uuidPattern.test(run)) await this.fetchRun(id, run);
      });
    });
    this.zone.runOutsideAngular(() => timer(5000, 5000).pipe(takeUntilDestroyed(this.destroy)).subscribe(() => {
      const run = this.results()?.run;
      if (run && this.activeStatuses.includes(run.status) && !this.busy()) this.zone.run(() => this.openRun(run.id));
    }));
  }

  protected allowed(...grants: string[]) {
    return canSimulate(this.context()?.permissions ?? [], ...grants);
  }

  protected reload() {
    void this.perform(id => this.refreshDirectory(id));
  }

  protected selectScenario(row: Scenario | null, editing = false) {
    if (row?.id !== this.selectedScenario()?.id) this.runId = '';
    this.selectedScenario.set(row);
    this.versions.set(null);
    this.editing.set(editing);
  }

  protected save(draft: ScenarioDraft) {
    const original = this.selectedScenario();
    void this.perform(async id => {
      const path = '/scenarios' + (original ? '/' + original.id + '/versions' : '');
      const body = original ? { name: draft.name, configuration: draft.configuration, expectedVersion: original.version } : draft;
      const result = await this.request(this.api.write<Scenario>(id, path, body));
      this.selectScenario(result);
      this.notice.set('Scenario version saved.');
      await this.refreshDirectory(id);
    });
  }

  protected scenarioAction(row: Scenario, action: 'duplicate' | 'archive') {
    void this.perform(async id => {
      const result = await this.request(this.api.write<Scenario>(id, '/scenarios/' + row.id + '/' + action));
      this.selectScenario(result);
      this.notice.set(action === 'archive' ? 'Scenario archived.' : 'Scenario duplicated.');
      await this.refreshDirectory(id);
    });
  }

  protected history(row: Scenario) {
    void this.perform(async id => {
      this.versions.set(await this.request(this.api.get<Version[]>(id, '/scenarios/' + row.id + '/versions')));
    });
  }

  protected executionPermission(row: Scenario) {
    if (row.type === 'NEW_HIRE' || row.type === 'LEGAL_RULE_CHANGE') return false;
    const scoped = row.type !== 'BULK_PAYROLL' && row.configuration.employeeIds?.length === 1;
    return this.allowed(this.p.execute, this.p.sensitive, scoped ? this.p.individual : this.p.bulk);
  }

  protected execute(row: Scenario) {
    void this.perform(async id => {
      const key = [id, row.id, row.version].join(':');
      const idempotencyKey = this.executionKeys.get(key) ?? globalThis.crypto.randomUUID();
      this.executionKeys.set(key, idempotencyKey);
      const run = await this.request(this.api.write<Run>(id, '/scenarios/' + row.id + '/runs',
        { version: row.version, idempotencyKey }));
      this.executionKeys.delete(key);
      this.runId = run.id;
      this.notice.set('Execution recorded.');
    });
  }

  protected openRun(id: string) {
    void this.perform(company => this.fetchRun(company, id));
  }

  protected runAction(run: Run, action: 'retry-failed' | 'cancel') {
    void this.perform(async id => {
      await this.request(this.api.write(id, '/runs/' + run.id + '/' + action));
      this.notice.set(action === 'cancel' ? 'Run cancelled.' : 'Retry requested for failed workers.');
      await this.fetchRun(id, run.id);
      await this.refreshDirectory(id);
    });
  }

  protected mayRetry(run: Run) {
    const scope = run.executionScope ?? (run.type === 'BULK_PAYROLL' || run.employeeIds?.length !== 1 ? 'bulk' : 'individual');
    return this.allowed(this.p.retry, this.p.execute, this.p.sensitive, this.p[scope]);
  }

  protected explain(run: Run, item: ResultLine) {
    void this.perform(async id => {
      this.explanation.set(await this.request(this.api.get<Explanation>(id, '/runs/' + run.id + '/explanation',
        { employeeId: item.employeeId })));
    });
  }

  protected compare() {
    if (!uuidPattern.test(this.baseline) || !this.runId || this.baseline === this.runId) {
      this.error.set('Select a run and enter a different valid baseline.');
      return;
    }
    void this.perform(async id => {
      const body = this.compareMode === 'official' ? { runId: this.runId, payrollRunId: this.baseline }
        : { baseRunId: this.baseline, comparedRunId: this.runId };
      this.comparisons.set(null);
      this.comparisons.set(await this.request(this.api.write<Comparison>(id,
        this.compareMode === 'official' ? '/comparisons/current-payroll' : '/comparisons', body)));
    });
  }

  protected addProjectionChange() {
    this.changes.push({ month: 1, salary: '', headcount: 0 });
  }

  protected loadProjections() {
    this.projections.set([]);
    void this.perform(async id => {
      this.projections.set(await this.request(this.api.get<Projection[]>(id, '/runs/' + this.runId + '/projections')));
    });
  }

  protected project() {
    const months = this.projectionMonths;
    const monthlyChanges = this.changes.map(change => ({
      month: change.month, salaryIncreasePct: change.salary.trim() ? decimal(change.salary, 5) : undefined,
      headcountDelta: change.headcount,
    }));
    if (!Number.isInteger(months) || months < 1 || months > 36 || monthlyChanges.some(change =>
      !Number.isInteger(change.month) || change.month < 1 || change.month > months ||
      change.salaryIncreasePct === null || !Number.isInteger(change.headcountDelta) || Math.abs(change.headcountDelta) > 500)) {
      this.error.set('Check the forecast horizon and monthly changes.');
      return;
    }
    void this.perform(async id => {
      const path = '/runs/' + this.runId + '/projections';
      await this.request(this.api.write<Projection>(id, path, { months, monthlyChanges }));
      this.projections.set(await this.request(this.api.get<Projection[]>(id, path)));
    });
  }

  protected submitProposal(run: Run) {
    void this.perform(async id => {
      await this.request(this.api.write(id, '/scenarios/' + run.scenarioId + '/proposals', { runId: run.id, reason: this.reason }));
      this.reason = '';
      this.notice.set('Proposal submitted for review.');
    });
  }

  protected openProposal(row: Proposal) {
    void this.perform(async id => {
      this.detail.set(await this.request(this.api.get<Proposal>(id, '/proposals/' + row.id)));
      this.reason = '';
    });
  }

  protected decide(row: Proposal, decision: 'approve' | 'reject' | 'request-revision') {
    void this.perform(async id => {
      const path = '/proposals/' + row.id;
      await this.request(this.api.write(id, path + '/' + decision, { reason: this.reason }));
      this.detail.set(await this.request(this.api.get<Proposal>(id, path)));
      this.reason = '';
      this.notice.set('Decision recorded.');
      await this.refreshDirectory(id);
    });
  }

  protected createExport(run: Run) {
    void this.perform(async id => {
      await this.request(this.api.write(id, '/runs/' + run.id + '/exports', { format: this.format }));
      this.notice.set(this.format + ' export created.');
    });
  }

  protected download(row: ExportRecord) {
    void this.perform(async id => {
      const blob = await this.request(this.api.download(id, row.id));
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = row.filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  private reset() {
    this.context.set(null);
    this.denied.set('');
    this.error.set('');
    this.notice.set('');
    this.busy.set(false);
    this.scenarios.set([]);
    this.selectScenario(null);
    this.runs.set([]);
    this.results.set(null);
    this.progress.set(null);
    this.explanation.set(null);
    this.comparisons.set(null);
    this.projections.set([]);
    this.proposals.set([]);
    this.detail.set(null);
    this.exports.set([]);
    this.executionKeys.clear();
    this.status = '';
    this.scenarioFilter = '';
    this.runId = '';
    this.baseline = '';
    this.compareMode = 'scenario';
    this.projectionMonths = 12;
    this.changes = [];
    this.format = 'CSV';
    this.reason = '';
  }

  private async refreshDirectory(id: number) {
    const section = this.section();
    switch (section?.view) {
      case 'scenarios': {
        const params: Record<string, string | number> = { limit: 100 };
        if (this.status) params['status'] = this.status;
        if (section.type) params['type'] = section.type;
        this.scenarios.set(await this.request(this.api.get<Scenario[]>(id, '/scenarios', params)));
        break;
      }
      case 'runs':
      case 'compare':
      case 'projections': {
        const analysis = section.view !== 'runs';
        const params: Record<string, string | number> = { limit: 100 };
        if (analysis) params['status'] = 'COMPLETED';
        else if (this.status) params['status'] = this.status;
        if (this.scenarioFilter) params['scenarioId'] = this.scenarioFilter;
        this.runs.set(await this.request(this.api.get<Run[]>(id, '/runs', params)));
        break;
      }
      case 'proposals':
        this.proposals.set(await this.request(this.api.get<Proposal[]>(id, '/proposals')));
        break;
      case 'exports': {
        const params: Record<string, string> = {};
        const run = this.route.snapshot.queryParamMap.get('run');
        if (run && uuidPattern.test(run)) params['runId'] = run;
        this.exports.set(await this.request(this.api.get<ExportRecord[]>(id, '/exports', params)));
        break;
      }
    }
  }

  private async fetchRun(company: number, id: string) {
    const changed = this.results()?.run.id !== id;
    if (changed) {
      this.results.set(null);
      this.progress.set(null);
      this.explanation.set(null);
      this.reason = '';
    }
    const { results, progress } = await this.request(forkJoin({
      results: this.api.get<RunResults>(company, '/runs/' + id + '/results'),
      progress: this.api.get<Progress>(company, '/runs/' + id + '/progress'),
    }));
    this.results.set(results);
    this.progress.set(progress);
    this.runs.update(rows => rows.map(run => run.id === id ? results.run : run));
  }

  private async request<T>(request: Observable<T>) {
    const generation = this.generation;
    const data = await firstValueFrom(request.pipe(takeUntil(this.route.data.pipe(
      // ActivatedRoute replays its current value. Only a new workspace invalidates the request.
      skip(1),
    )), takeUntilDestroyed(this.destroy)));
    if (generation !== this.generation || this.destroy.destroyed) throw new Error('Workspace changed.');
    return data;
  }

  private async perform(task: (company: number) => Promise<void>) {
    const id = this.context()?.company.id;
    if (!id || this.denied() || this.busy()) return;
    const generation = this.generation;
    const finish = this.pending.add();
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    try {
      await task(id);
    } catch (error) {
      if (!this.destroy.destroyed && generation === this.generation) this.error.set(apiErrorMessage(error));
    } finally {
      if (!this.destroy.destroyed && generation === this.generation) this.busy.set(false);
      finish();
    }
  }
}
