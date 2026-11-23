import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, expand, map, reduce } from 'rxjs';
import { API_CONFIG } from '../../../core/api/api-config';
import { ApiPage, companyScope } from '../../../core/api/company-workspace-api';
import {
  Application, ApplicationInput, AuditEvent, Contract, Decision, Deduction, Disbursement, Employee, Installment,
  Loan, LoanHistory, LoanPage, LoanQuery, LoanSummary, Plan, Policy, PolicyInput, Renegotiation, RenegotiationInput,
  Repayment, Simulation, Terms,
} from '../domain/loans.models';

type Params = Record<string, string | number>;
type Envelope<T> = { data: T };

@Injectable({ providedIn: 'root' })
export class LoansApi {
  private readonly http = inject(HttpClient);
  private readonly apiBase = inject(API_CONFIG).apiBaseUrl;
  private readonly base = this.apiBase + '/loans';

  applications(company: number, query: LoanQuery = {}, page = 1, limit = 20) {
    return this.page<Application>(company, '/applications', { ...query }, page, limit);
  }
  application(company: number, id: string) { return this.get<Application>(company, this.applicationPath(id)); }
  saveApplication(company: number, input: ApplicationInput, id?: string) {
    if (!id) return this.post<Application>(company, '/applications', input);
    return this.http.patch<Envelope<Application>>(this.base + this.applicationPath(id), input, companyScope(company))
      .pipe(map(response => response.data));
  }
  applicationAction(company: number, id: string, action: 'submit' | 'cancel') {
    return this.post<Application>(company, this.applicationPath(id) + '/' + action, {});
  }
  decideApplication(company: number, id: string, decision: Decision, comments?: string) {
    return this.post<Application>(company, this.applicationPath(id) + '/decision', { decision, comments });
  }
  simulate(company: number, terms: Terms) { return this.post<Simulation>(company, '/simulations', terms); }

  loans(company: number, query: LoanQuery = {}, page = 1, limit = 20) {
    return this.page<Loan>(company, '', { ...query }, page, limit);
  }
  loan(company: number, id: string) { return this.get<Loan>(company, this.loanPath(id)); }
  plans(company: number, id: string) { return this.get<Plan[]>(company, this.loanPath(id, 'plans')); }
  installments(company: number, id: string) { return this.get<Installment[]>(company, this.loanPath(id, 'installments')); }
  history(company: number, id: string) { return this.get<LoanHistory>(company, this.loanPath(id, 'history')); }
  status(company: number, id: string, action: 'SUSPEND' | 'RESUME') {
    return this.post<Loan>(company, this.loanPath(id, 'status'), { action });
  }
  settle(company: number, id: string) { return this.post<unknown>(company, this.loanPath(id, 'settle'), {}); }

  disbursements(company: number, id: string) { return this.get<Disbursement[]>(company, this.loanPath(id, 'disbursements')); }
  requestDisbursement(company: number, id: string, idempotencyKey: string, paymentReference?: string) {
    return this.post<Disbursement>(company, this.loanPath(id, 'disbursements'), { paymentReference, idempotencyKey });
  }
  confirmDisbursement(company: number, id: string, disbursement: string, paymentReference: string) {
    return this.post<Loan>(company, this.loanPath(id, 'disbursements') + '/' + encodeURIComponent(disbursement) + '/confirm', { paymentReference });
  }

  repayments(company: number, id: string) { return this.get<Repayment[]>(company, this.loanPath(id, 'repayments')); }
  registerRepayment(company: number, id: string, input: { amount: string; source: string; externalReference: string; idempotencyKey: string }) {
    return this.post<Repayment>(company, this.loanPath(id, 'repayments'), input);
  }
  reverseRepayment(company: number, id: string, repayment: string, reversalReference: string) {
    return this.post<Repayment>(company, this.loanPath(id, 'repayments') + '/' + encodeURIComponent(repayment) + '/reverse', { reversalReference });
  }

  deductions(company: number, query: { loanId?: string; status?: string } = {}, page = 1, limit = 20) {
    return this.page<Deduction>(company, '/deductions', query, page, limit);
  }
  requestDeduction(company: number, id: string, idempotencyKey: string) {
    return this.post<Deduction>(company, this.loanPath(id, 'deductions'), { idempotencyKey });
  }
  confirmDeduction(company: number, id: string, input: { payrollRunId: string; confirmedAmount: string; idempotencyKey: string }) {
    return this.post<Deduction>(company, '/deductions/' + encodeURIComponent(id) + '/confirm', input);
  }

  requestRenegotiation(company: number, id: string, input: RenegotiationInput) {
    return this.post<Renegotiation>(company, this.loanPath(id, 'renegotiations'), input);
  }
  decideRenegotiation(company: number, id: string, decision: Decision) {
    return this.post<Renegotiation>(company, '/renegotiations/' + encodeURIComponent(id) + '/decision', { decision });
  }

  policies(company: number) { return this.get<Policy[]>(company, '/policies'); }
  publishPolicy(company: number, input: PolicyInput) { return this.post<Policy>(company, '/policies', input); }
  summary(company: number) { return this.get<LoanSummary>(company, '/reports/summary'); }
  outstanding(company: number, page = 1, limit = 20) { return this.page<Loan>(company, '/reports/outstanding', {}, page, limit); }
  overdue(company: number, page = 1, limit = 20) { return this.page<Installment>(company, '/reports/late-installments', {}, page, limit); }

  employees(company: number, search: string) {
    return this.http.get<ApiPage<Employee>>(this.apiBase + '/company/employees', {
      ...companyScope(company), params: { page: 1, limit: 20, search },
    }).pipe(map(response => response.data));
  }
  employee(company: number, id: string) {
    return this.http.get<Envelope<Employee>>(this.apiBase + '/company/employees/' + encodeURIComponent(id), companyScope(company))
      .pipe(map(response => response.data));
  }
  contracts(company: number, employeeId: string) {
    return this.http.get<ApiPage<Contract>>(this.apiBase + '/contracts', {
      ...companyScope(company), params: { employeeId, status: 'ACTIVE', page: 1, limit: 100 },
    }).pipe(map(response => response.data));
  }
  audit(company: number, purpose: string, filter: { action?: string; resourceId?: string }, cursor?: number, throughSequence?: number) {
    return this.http.get<Envelope<{ data: AuditEvent[]; nextCursor: number | null; throughSequence: number }>>(
      this.apiBase + '/audit/records', {
        headers: { ...companyScope(company).headers, 'X-Audit-Purpose': purpose },
        params: { module: 'loans', limit: 30, ...filter, ...(cursor == null ? {} : { cursor }),
          ...(throughSequence == null ? {} : { throughSequence }) },
      },
    ).pipe(map(response => response.data));
  }

  all<T>(get: (page: number) => Observable<LoanPage<T>>) {
    return get(1).pipe(
      expand(result => result.page * result.limit < result.total ? get(result.page + 1) : EMPTY),
      reduce((rows, result) => { rows.push(...result.data); return rows; }, [] as T[]),
    );
  }

  private page<T>(company: number, path: string, query: Params, page: number, limit: number) {
    return this.http.get<LoanPage<T>>(this.base + path, { ...companyScope(company), params: { ...query, page, limit } });
  }
  private get<T>(company: number, path: string) {
    return this.http.get<Envelope<T>>(this.base + path, companyScope(company)).pipe(map(response => response.data));
  }
  private post<T>(company: number, path: string, input: unknown) {
    return this.http.post<Envelope<T>>(this.base + path, input, companyScope(company)).pipe(map(response => response.data));
  }
  private loanPath(id: string, section?: string) {
    return '/' + encodeURIComponent(id) + (section ? '/' + section : '');
  }
  private applicationPath(id: string) { return '/applications/' + encodeURIComponent(id); }
}
