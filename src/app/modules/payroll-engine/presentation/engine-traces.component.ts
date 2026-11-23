import { Component, computed, inject, Input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map, of } from 'rxjs';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { isPayrollId, payrollDate, payrollMoney } from '../../payroll/domain/payroll-format';
import { RUN_TITLES } from '../../payroll/domain/payroll.models';
import { PayrollApi } from '../../payroll/infrastructure/payroll-api.service';
import { payrollQuery } from '../../payroll/presentation/payroll-ui';
import { savedEngineEvidence } from '../domain/saved-engine-evidence';
import { EngineEvidenceComponent } from './engine-evidence.component';

@Component({
  selector: 'app-engine-traces',
  standalone: true,
  imports: [FormsModule, RouterLink, ComponentCardComponent, EngineEvidenceComponent],
  templateUrl: './engine-traces.component.html',
})
export class EngineTracesComponent {
  private readonly company = signal(0);
  @Input({ required: true }) set companyId(id: number) { this.company.set(id); }

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(PayrollApi);
  private readonly runsRetry = signal(0);
  private readonly resultsRetry = signal(0);
  private readonly traceRetry = signal(0);
  protected readonly ids = toSignal(this.route.queryParamMap.pipe(map(params => {
    const run = params.get('run') ?? '';
    const result = params.get('result') ?? '';
    return { run: isPayrollId(run) ? run : '', result: isPayrollId(run) && isPayrollId(result) ? result : '' };
  })), { requireSync: true });
  private readonly selectedRun = computed(() => this.ids().run);
  protected readonly search = signal('');
  protected readonly page = signal(1);
  protected readonly pageSize = 15;
  protected readonly titles = RUN_TITLES;
  protected readonly date = payrollDate;
  protected readonly money = payrollMoney;

  protected readonly availableRuns = payrollQuery(computed(() => ({
    company: this.company(), retry: this.runsRetry(),
  })), ({ company }) => company ? this.api.allRuns(company) : of([]));

  protected readonly availableResults = payrollQuery(computed(() => ({
    company: this.company(), run: this.selectedRun(), retry: this.resultsRetry(),
  })), ({ company, run }) => company && run ? this.api.runRead(company, run, 'results') : of([]));

  protected readonly saved = payrollQuery(computed(() => ({
    company: this.company(), ...this.ids(), retry: this.traceRetry(),
  })), ({ company, run, result }) => company && run && result
    ? this.api.explanation(company, run, result).pipe(map(explanation => savedEngineEvidence(explanation)))
    : of(null));

  protected readonly matching = computed(() => {
    const state = this.availableResults();
    const filter = this.search().trim().toLowerCase();
    return state && 'data' in state ? state.data.filter(row => row.employeeId.toLowerCase().includes(filter)) : [];
  });

  protected readonly rows = computed(() => this.matching().slice((this.page() - 1) * this.pageSize, this.page() * this.pageSize));

  protected openRun(id: string) {
    this.page.set(1);
    this.search.set('');
    void this.router.navigate([], {
      relativeTo: this.route, queryParams: { run: id || null, result: null }, queryParamsHandling: 'merge', replaceUrl: true,
    });
  }

  protected setSearch(value: string) { this.page.set(1); this.search.set(value); }
  protected changePage(delta: number) { this.page.update(value => value + delta); }
  protected reloadRuns() { this.runsRetry.update(value => value + 1); }
  protected reloadResults() { this.resultsRetry.update(value => value + 1); }
  protected reloadTrace() { this.traceRetry.update(value => value + 1); }
}
