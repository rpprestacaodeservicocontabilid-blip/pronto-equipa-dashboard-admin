import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin, from, map, mergeMap, of, reduce, toArray } from 'rxjs';
import { CompanyWorkspace } from '../../../core/api/company-workspace-api';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { childCollection, OrganizationApi } from '../../organization/infrastructure/organization-api.service';
import { centsAmount, payrollCents, payrollDate, payrollLabel, payrollMoney } from '../domain/payroll-format';
import { PayrollRun, RUN_STATUSES, RUN_TITLES } from '../domain/payroll.models';
import { SENSITIVE_RESULTS } from '../domain/payroll-sections';
import { PayrollApi } from '../infrastructure/payroll-api.service';
import { payrollQuery } from './payroll-ui';

const INCOMPLETE = ['DRAFT', 'VALIDATING', 'VALIDATION_FAILED', 'PROCESSING', 'FAILED', 'PARTIALLY_PROCESSED', 'READY_FOR_REVIEW', 'SUBMITTED'];
const WITH_CALCULATIONS = ['PROCESSING', 'PARTIALLY_PROCESSED', 'FAILED', 'READY_FOR_REVIEW', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CLOSED'];

@Component({
  selector: 'app-payroll-overview', standalone: true,
  imports: [FormsModule, RouterLink, ComponentCardComponent], templateUrl: './payroll-overview.component.html',
})
export class PayrollOverviewComponent {
  readonly context = input.required<CompanyWorkspace>();
  private readonly api = inject(PayrollApi);
  private readonly organization = inject(OrganizationApi);
  private readonly refresh = signal(0);
  private readonly retry = signal(0);
  private readonly retryOrganization = signal(0);
  protected readonly date = payrollDate;
  protected readonly label = payrollLabel;
  protected readonly money = payrollMoney;
  protected readonly statuses = RUN_STATUSES;
  protected readonly titles = RUN_TITLES;
  protected readonly status = signal('');
  protected readonly establishment = signal('');
  protected readonly department = signal('');
  protected readonly canFilterOrganization = computed(() => {
    const grants = this.context().permissions;
    return grants.includes('organization:read') && grants.includes(SENSITIVE_RESULTS);
  });
  protected readonly index = payrollQuery(computed(() => {
    this.refresh();
    return this.context().company.id;
  }), company => forkJoin({ runs: this.api.allRuns(company), periods: this.api.allPeriods(company) }));
  protected readonly periods = computed(() => {
    const index = this.index();
    return index && 'data' in index ? index.data.periods : [];
  });
  protected readonly period = linkedSignal(() => this.periods()[0]?.id ?? '');
  protected readonly organizationOptions = payrollQuery(computed(() => ({
    enabled: this.canFilterOrganization(), company: this.context().company.id, retry: this.retryOrganization(),
  })), ({ enabled, company }) => enabled
    ? forkJoin({ establishments: this.organization.all(company, 'establishments'), departments: this.organization.all(company, 'departments') })
    : of({ establishments: [], departments: [] }));
  protected readonly departmentOptions = computed(() => {
    const options = this.organizationOptions();
    const establishment = this.establishment();
    return options && 'data' in options ? options.data.departments.filter(department =>
      !establishment || department.data['establishmentId'] === establishment) : [];
  });
  private readonly organizationFilter = computed(() => {
    const establishment = this.establishment();
    const department = this.department();
    const date = this.periods().find(period => period.id === this.period())?.endDate ?? '';
    if (!this.canFilterOrganization() || !(establishment || department)) return null;
    const options = this.organizationOptions();
    const ready = !!options && 'data' in options;
    const departments = this.departmentOptions().filter(option => !department || option.id === department).map(option => option.id);
    return { key: [establishment, department, date, ...departments].join('/'), date, departments, ready };
  });
  private readonly membership = payrollQuery(computed(() => ({
    company: this.context().company.id, filter: this.organizationFilter(), retry: this.retryOrganization(),
  })), ({ company, filter }) => filter?.ready ? from(filter.departments).pipe(
    mergeMap(id => this.organization.all(company, childCollection('departments', id, 'employees')), 4),
    reduce((employees, rows) => {
      for (const row of rows) {
        if (row.employeeId && (row.status === 'ACTIVE' || row.effectiveTo) &&
            (!row.effectiveFrom || row.effectiveFrom <= filter.date) && (!row.effectiveTo || row.effectiveTo >= filter.date)) {
          employees.add(row.employeeId);
        }
      }
      return employees;
    }, new Set<string>()),
    map(employees => ({ key: filter.key, employees })),
  ) : of(null));
  protected readonly organizationPending = computed(() => {
    const filter = this.organizationFilter();
    const membership = this.membership();
    return !!filter && (!filter.ready || !membership || ('data' in membership && membership.data?.key !== filter.key));
  });
  protected readonly organizationError = computed(() => {
    const membership = this.membership();
    const filter = this.organizationFilter();
    const options = this.organizationOptions();
    if (filter && options && 'error' in options) return options.error;
    return filter && membership && 'error' in membership ? membership.error : '';
  });
  private readonly employees = computed(() => {
    const filter = this.organizationFilter();
    const membership = this.membership();
    return filter && membership && 'data' in membership && membership.data?.key === filter.key ? membership.data.employees : null;
  });
  protected readonly activity = computed(() => {
    const index = this.index();
    if (!index || !('data' in index) || this.organizationPending() || this.organizationError()) return [];
    const employees = this.employees();
    return index.data.runs.filter(run => run.periodId === this.period() && (!this.status() || run.status === this.status()))
      .map(run => ({ run, employeeCount: employees ? run.employeeIds.filter(id => employees.has(id)).length : run.employeeIds.length }))
      .filter(row => !employees || row.employeeCount > 0);
  });
  protected readonly metrics = payrollQuery(computed(() => {
    this.retry();
    return { company: this.context().company.id, rows: this.activity(), employees: this.employees() };
  }), ({ company, rows, employees }) => from(rows).pipe(
    mergeMap(({ run }) => forkJoin({
      totals: this.totals(company, run, employees),
      issues: ['VALIDATING', 'VALIDATION_FAILED', 'PROCESSING', 'PARTIALLY_PROCESSED', 'FAILED'].includes(run.status)
        ? this.api.runRead(company, run.id, 'issues') : of([]),
    }).pipe(map(data => ({ run, ...data }))), 3),
    toArray(),
    map(rows => {
      const currencies = new Map<string, bigint>();
      for (const { run, totals } of rows) {
        if (run.runType === 'REGULAR') {
          for (const { currency, netAmount } of totals.net) {
            currencies.set(currency, (currencies.get(currency) ?? 0n) + payrollCents(netAmount));
          }
        }
      }
      return {
        employees: rows.reduce((count, row) => count + row.totals.employees, 0),
        net: [...currencies].map(([currency, amount]) => this.money(centsAmount(amount), currency)),
        pending: rows.filter(row => INCOMPLETE.includes(row.run.status)).length,
        blockers: rows.reduce((count, row) => count + row.issues.filter(issue =>
          issue.status === 'OPEN' && issue.data.severity === 'BLOCKING' &&
          (!employees || !issue.employeeId || employees.has(issue.employeeId))).length, 0),
      };
    }),
  ));
  protected reload() { this.refresh.update(value => value + 1); }
  protected retryMetrics() { this.retry.update(value => value + 1); }
  protected retryScope() { this.retryOrganization.update(value => value + 1); }

  private totals(company: number, run: PayrollRun, employees: Set<string> | null) {
    if (!WITH_CALCULATIONS.includes(run.status)) return of({ employees: 0, net: [] });
    if (employees) return this.api.runRead(company, run.id, 'results').pipe(map(results => {
      const selected = results.filter(result => employees.has(result.employeeId));
      return { employees: selected.length, net: selected };
    }));
    return this.api.runRead(company, run.id, 'summary').pipe(
      map(summary => ({ employees: summary.employees, net: summary.currency ? [summary] : [] })),
    );
  }
}
