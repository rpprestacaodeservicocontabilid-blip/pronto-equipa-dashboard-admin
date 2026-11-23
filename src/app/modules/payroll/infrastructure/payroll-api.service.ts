import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, expand, map, reduce } from 'rxjs';
import { API_CONFIG } from '../../../core/api/api-config';
import { ApiPage, companyScope } from '../../../core/api/company-workspace-api';
import {
  ExportFormat, LineReportRow, NewRun, PayrollApproval, PayrollClosing, PayrollComparison, PayrollEmployee,
  PayrollExplanation, PayrollExport, PayrollInstruction, PayrollIssue, PayrollPage, PayrollPeriod, PayrollPolicy,
  PayrollProgress, PayrollResult, PayrollRun, PayrollSummary, PeriodDates, ReportType, RunAction, SummaryReportRow,
} from '../domain/payroll.models';

interface RunReads {
  progress: PayrollProgress;
  summary: PayrollSummary;
  issues: PayrollIssue[];
  results: PayrollResult[];
  closing: PayrollClosing[];
  history: PayrollApproval[];
  'payment-instructions': PayrollInstruction[];
}

export function collectPayrollPages<T>(fetch: (page: number) => Observable<PayrollPage<T>>) {
  return fetch(1).pipe(
    expand(response => response.page * response.limit < response.total ? fetch(response.page + 1) : EMPTY),
    reduce((rows, page) => { rows.push(...page.data); return rows; }, [] as T[]),
  );
}

@Injectable({ providedIn: 'root' })
export class PayrollApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_CONFIG).apiBaseUrl;
  private readonly url = this.base + '/payroll/';

  private read<T>(company: number, path: string, params?: Record<string, string | number>) {
    return this.http.get<{ data: T }>(this.url + path, { ...companyScope(company), params }).pipe(map(reply => reply.data));
  }

  private write<T>(company: number, path: string, body: object, method: 'POST' | 'PATCH' = 'POST') {
    return this.http.request<{ data: T }>(method, this.url + path, { ...companyScope(company), body }).pipe(map(reply => reply.data));
  }

  periods(company: number, page = 1, limit = 100) {
    return this.read<PayrollPage<PayrollPeriod>>(company, 'periods', { page, limit });
  }

  allPeriods(company: number) { return collectPayrollPages(page => this.periods(company, page)); }

  period(company: number, id: string) { return this.read<PayrollPeriod>(company, 'periods/' + id); }

  savePeriod(company: number, dates: PeriodDates, period?: PayrollPeriod) {
    return period
      ? this.write<PayrollPeriod>(company, 'periods/' + period.id, { ...dates, expectedVersion: period.version }, 'PATCH')
      : this.write<PayrollPeriod>(company, 'periods', dates);
  }

  changePeriod(company: number, period: PayrollPeriod, action: 'open' | 'close') {
    return this.write<PayrollPeriod>(company, 'periods/' + period.id + '/' + action, { expectedVersion: period.version });
  }

  runs(company: number, page = 1, limit = 100) {
    return this.read<PayrollPage<PayrollRun>>(company, 'runs', { page, limit });
  }

  allRuns(company: number) { return collectPayrollPages(page => this.runs(company, page)); }

  run(company: number, id: string) { return this.read<PayrollRun>(company, 'runs/' + id); }

  createRun(company: number, input: NewRun) {
    if (input.originalRunId && (input.runType === 'CORRECTION' || input.runType === 'SUPPLEMENTARY')) {
      const { originalRunId, runType, ...body } = input;
      const resource = runType === 'CORRECTION' ? 'corrections' : 'supplements';
      return this.write<PayrollRun>(company, 'runs/' + originalRunId + '/' + resource, body);
    }
    return this.write<PayrollRun>(company, 'runs', input);
  }

  runAction(company: number, run: PayrollRun, action: RunAction, reason?: string) {
    const body = { expectedVersion: run.version, ...(reason ? { reason } : {}) };
    return this.write<unknown>(company, 'runs/' + run.id + '/' + action, body);
  }

  runRead<K extends keyof RunReads>(company: number, id: string, resource: K) {
    return this.read<RunReads[K]>(company, 'runs/' + id + '/' + resource);
  }

  result(company: number, run: string, result: string) {
    return this.read<PayrollResult>(company, 'runs/' + run + '/results/' + result);
  }

  explanation(company: number, run: string, result: string) {
    return this.read<PayrollExplanation>(company, 'runs/' + run + '/results/' + result + '/explanation');
  }

  compare(company: number, run: string, otherRunId: string) {
    return this.read<PayrollComparison[]>(company, 'runs/' + run + '/comparison', { otherRunId });
  }

  report(company: number, periodId: string, type: ReportType) {
    return this.read<SummaryReportRow[] | LineReportRow[]>(company, 'reports/' + type, { periodId });
  }

  policies(company: number) { return this.read<PayrollPolicy[]>(company, 'policies'); }

  createPolicy(company: number, code: string, requiredApprovals: number) {
    return this.write<PayrollPolicy>(company, 'policies', { code, requiredApprovals });
  }

  export(company: number, runId: string, format: ExportFormat, idempotencyKey: string) {
    return this.write<PayrollExport>(company, 'exports', { runId, format, idempotencyKey });
  }

  download(company: number, id: string) {
    return this.http.get(this.url + 'exports/' + id + '/download', { ...companyScope(company), responseType: 'blob' });
  }

  employees(company: number, page: number, search = '', activeOnly = false) {
    const params = { page, limit: 100, ...(search ? { search } : {}), ...(activeOnly ? { status: 'ACTIVE' } : {}) };
    return this.http.get<ApiPage<PayrollEmployee>>(this.base + '/company/employees', { ...companyScope(company), params });
  }
}
