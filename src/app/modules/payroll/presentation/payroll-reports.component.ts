import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { CompanyWorkspace } from '../../../core/api/company-workspace-api';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { payrollDate, payrollMoney } from '../domain/payroll-format';
import { LineReportRow, ReportType, SummaryReportRow } from '../domain/payroll.models';
import { SENSITIVE_RESULTS } from '../domain/payroll-sections';
import { PayrollApi } from '../infrastructure/payroll-api.service';
import { payrollQuery, payrollQueryParam } from './payroll-ui';

@Component({
  selector: 'app-payroll-reports', standalone: true,
  imports: [FormsModule, RouterLink, ComponentCardComponent], templateUrl: './payroll-reports.component.html',
})
export class PayrollReportsComponent {
  readonly context = input.required<CompanyWorkspace>();
  private readonly api = inject(PayrollApi);
  private readonly initialPeriod = payrollQueryParam('period');
  private readonly reloadPeriods = signal(0);
  private readonly reloadReport = signal(0);
  protected readonly date = payrollDate;
  protected readonly money = payrollMoney;
  protected readonly pageSize = 30;
  protected readonly page = signal(1);
  protected readonly type = signal<ReportType>('summary');
  protected readonly sensitive = computed(() => this.context().permissions.includes(SENSITIVE_RESULTS));
  protected readonly periods = payrollQuery(computed(() => {
    this.reloadPeriods();
    return this.context().company.id;
  }), company => this.api.allPeriods(company));
  protected readonly period = linkedSignal(() => {
    const state = this.periods();
    if (!state || !('data' in state)) return '';
    const initial = this.initialPeriod();
    return state.data.some(period => period.id === initial) ? initial : state.data[0]?.id ?? '';
  });
  protected readonly report = payrollQuery(computed(() => {
    this.reloadReport();
    return { company: this.context().company.id, period: this.period(), type: this.type(), sensitive: this.sensitive() };
  }), ({ company, period, type, sensitive }) =>
    period && (type === 'summary' || sensitive) ? this.api.report(company, period, type) : of([]));
  protected readonly visible = computed(() => {
    const state = this.report();
    return state && 'data' in state ? state.data.slice((this.page() - 1) * this.pageSize, this.page() * this.pageSize) : [];
  });
  protected summary(row: SummaryReportRow | LineReportRow): row is SummaryReportRow { return 'employees' in row; }
  protected refreshOptions() { this.reloadPeriods.update(value => value + 1); }
  protected refreshReport() { this.reloadReport.update(value => value + 1); }
  protected changePage(delta: number) { this.page.update(value => value + delta); }
}
