import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, expand, map, toArray } from 'rxjs';
import { API_CONFIG } from '../../../core/api/api-config';
import { CompanyWorkspaceApi, companyScope } from '../../../core/api/company-workspace-api';
import {
  ContractAction, ContractQuery, ContractRecord,
  ContractType, CreateContract, Department, DocumentSummary, DraftFields, EmployeeSummary,
  EmploymentContract, Page, SalaryAssignment,
} from '../domain/contracts.models';

interface Data<T> { data: T }

@Injectable({ providedIn: 'root' })
export class ContractsApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(API_CONFIG);
  private readonly workspace = inject(CompanyWorkspaceApi);

  private url(path: string) { return this.config.apiBaseUrl + path; }
  private scope = companyScope;

  companies() {
    return this.workspace.companies();
  }

  context(companyId: number) {
    return this.workspace.context(companyId);
  }

  list(companyId: number, query: ContractQuery = {}, page = 1, limit = 20) {
    return this.http.get<Page<EmploymentContract>>(this.url('/contracts'), {
      ...this.scope(companyId), params: { ...query, page, limit },
    });
  }

  all(companyId: number, query: ContractQuery = {}) {
    return this.collectPages(page => this.list(companyId, query, page, 100));
  }

  expiring(companyId: number, days: number) {
    return this.http.get<Page<EmploymentContract>>(this.url('/contracts/expiring'), {
      ...this.scope(companyId), params: { days },
    });
  }

  types(companyId: number) {
    return this.http.get<Data<ContractType[]>>(this.url('/contracts/types'), this.scope(companyId))
      .pipe(map(result => result.data));
  }

  createType(companyId: number, input: Omit<ContractType, 'id' | 'companyId'>) {
    return this.http.post<Data<ContractType>>(this.url('/contracts/types'), input, this.scope(companyId))
      .pipe(map(result => result.data));
  }

  get(companyId: number, id: string) {
    return this.http.get<Data<EmploymentContract>>(this.contractUrl(id), this.scope(companyId))
      .pipe(map(result => result.data));
  }

  create(companyId: number, input: CreateContract) {
    return this.http.post<Data<EmploymentContract>>(this.url('/contracts'), input, this.scope(companyId))
      .pipe(map(result => result.data));
  }

  update(companyId: number, contract: EmploymentContract, input: DraftFields) {
    return this.http.patch<Data<EmploymentContract>>(this.contractUrl(contract.id), {
      ...input, expectedVersion: contract.version,
    }, this.scope(companyId)).pipe(map(result => result.data));
  }

  act(companyId: number, contract: EmploymentContract, action: ContractAction, fields: Record<string, unknown>) {
    return this.http.post<Data<EmploymentContract>>(this.contractUrl(contract.id, action), {
      ...fields, expectedVersion: contract.version,
    }, this.scope(companyId)).pipe(map(result => result.data));
  }

  records(companyId: number, id: string, section: 'history' | 'documents') {
    return this.http.get<Data<ContractRecord[]>>(this.contractUrl(id, section), this.scope(companyId))
      .pipe(map(result => result.data));
  }

  employees(companyId: number, page: number, search = '') {
    return this.http.get<Page<EmployeeSummary>>(this.url('/company/employees'), {
      ...this.scope(companyId), params: { page, limit: 100, search },
    });
  }

  employeeDirectory(companyId: number) {
    return this.collectPages(page => this.employees(companyId, page));
  }

  employee(companyId: number, id: string) {
    return this.http.get<Data<EmployeeSummary>>(this.url('/company/employees/' + encodeURIComponent(id)), this.scope(companyId))
      .pipe(map(result => result.data));
  }

  departments(companyId: number) {
    return this.collectPages(page => this.http.get<Page<Department>>(this.url('/organization/departments'), {
      ...this.scope(companyId), params: { page, limit: 100 },
    }));
  }

  salaryAssignments(companyId: number, employeeId: string, contractId: string) {
    const limit = 100;
    return this.collectPages(page => this.http.get<Data<{ data: SalaryAssignment[]; total: number }>>(
      this.url('/salary-structure/assignments'), { ...this.scope(companyId), params: { employeeId, page, limit } },
    ).pipe(map(({ data }) => ({
      data: data.data.filter(assignment => assignment.contractId === contractId),
      pagination: { page, limit, total: data.total, totalPages: Math.ceil(data.total / limit) },
    }))));
  }

  documentPage(companyId: number, page: number) {
    return this.http.get<Data<DocumentSummary[]>>(this.url('/documents'), {
      ...this.scope(companyId), params: { page, limit: 25, status: 'ACTIVE' },
    }).pipe(map(result => result.data));
  }

  attachDocument(companyId: number, id: string, documentId: string, documentType: string) {
    return this.http.post<Data<EmploymentContract>>(this.contractUrl(id, 'documents'), {
      documentId, documentType,
    }, this.scope(companyId)).pipe(map(result => result.data));
  }

  documentAccess(companyId: number, id: string, purpose: 'preview' | 'download') {
    return this.http.get<Data<{ url: string }>>(this.url('/documents/' + encodeURIComponent(id) + '/' + purpose),
      this.scope(companyId)).pipe(map(result => result.data.url));
  }

  private contractUrl(id: string, section?: string) {
    return this.url('/contracts/' + encodeURIComponent(id) + (section ? '/' + section : ''));
  }

  private collectPages<T>(getPage: (page: number) => Observable<Page<T>>) {
    return getPage(1).pipe(
      expand(result => result.pagination.page < result.pagination.totalPages
        ? getPage(result.pagination.page + 1) : EMPTY),
      toArray(),
      map(pages => pages.flatMap(result => result.data)),
    );
  }
}
