import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { CompanyWorkspace } from '../../../core/api/company-workspace-api';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { payrollDate, payrollLabel } from '../domain/payroll-format';
import { RUN_STATUSES, RUN_TITLES } from '../domain/payroll.models';
import { canCreatePayrollRun, matchesPayrollSection, PayrollSection } from '../domain/payroll-sections';
import { PayrollApi } from '../infrastructure/payroll-api.service';
import { payrollQuery, payrollQueryParam } from './payroll-ui';

@Component({
  selector: 'app-payroll-runs', standalone: true,
  imports: [FormsModule, RouterLink, ComponentCardComponent], templateUrl: './payroll-runs.component.html',
})
export class PayrollRunsComponent {
  readonly context = input.required<CompanyWorkspace>();
  readonly section = input.required<PayrollSection>();
  private readonly api = inject(PayrollApi);
  private readonly refreshCount = signal(0);
  private readonly queryPeriod = payrollQueryParam('period');
  protected readonly status = signal('');
  protected readonly period = signal<string | undefined>(undefined);
  protected readonly page = signal(1);
  protected readonly date = payrollDate;
  protected readonly label = payrollLabel;
  protected readonly titles = RUN_TITLES;
  protected readonly statuses = computed(() => this.section().statuses ?? RUN_STATUSES);
  protected readonly pageSize = 20;
  protected readonly root = computed(() => ['/payroll', this.context().company.id, this.section().path]);
  protected readonly canCreate = computed(() => this.section().create?.some(type => canCreatePayrollRun(type, this.context().permissions)));
  protected readonly data = payrollQuery(computed(() => {
    this.refreshCount();
    return { company: this.context().company.id };
  }), ({ company }) => forkJoin({ periods: this.api.allPeriods(company), runs: this.api.allRuns(company) }));
  protected readonly selectedPeriod = computed(() => this.period() ?? this.queryPeriod());
  protected readonly filtered = computed(() => {
    const state = this.data();
    if (!state || !('data' in state)) return [];
    return state.data.runs.filter(run => matchesPayrollSection(this.section(), run) &&
      (!this.status() || run.status === this.status()) &&
      (!this.selectedPeriod() || run.periodId === this.selectedPeriod()));
  });
  protected readonly visible = computed(() => this.filtered().slice((this.page() - 1) * this.pageSize, this.page() * this.pageSize));
  private readonly periods = computed(() => {
    const response = this.data();
    return new Map(response && 'data' in response ? response.data.periods.map(period => [period.id, period]) : []);
  });

  protected periodLabel(id: string) {
    const period = this.periods().get(id);
    return period ? this.date(period.startDate) + ' – ' + this.date(period.endDate) : id;
  }

  protected changePage(delta: number) { this.page.update(page => page + delta); }

  protected refresh() { this.refreshCount.update(value => value + 1); }
}
