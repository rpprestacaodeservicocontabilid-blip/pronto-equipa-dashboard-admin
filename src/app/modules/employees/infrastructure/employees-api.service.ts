import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map } from 'rxjs';
import { API_CONFIG } from '../../../core/api/api-config';
import { ApiPage, companyScope } from '../../../core/api/company-workspace-api';
import { BankAccount, Dependent, DependentInput, Employee, EmployeeFilter, EmployeeHistory, EmployeePersonal, EmployeeProfessional, EmployeeRegistration, EmployeeStatus, ImportResult } from '../domain/employee.models';
import { ProfileContent, ProfileSection, ProfileVersion, RegistrationDetails, RegistrationsPage, RegistrationStatus } from '../domain/employee-administration';

interface Reply<T> { data: T }
type RequestBody = object;

@Injectable({ providedIn: 'root' })
export class EmployeesApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_CONFIG).apiBaseUrl + '/company/employees';

  list(company: number, filter: EmployeeFilter) {
    return this.http.get<ApiPage<Employee>>(this.base, { ...companyScope(company), params: this.params(filter) });
  }

  create(company: number, body: EmployeeRegistration) {
    return this.send<Employee>(company, '', 'POST', body);
  }

  get(company: number, employee: string) { return this.read<Employee>(company, employee); }
  personal(company: number, employee: string) { return this.read<EmployeePersonal>(company, employee, '/personal-info'); }
  history(company: number, employee: string) { return this.read<EmployeeHistory>(company, employee, '/history'); }
  bank(company: number, employee: string) { return this.read<BankAccount | null>(company, employee, '/bank-account'); }
  dependents(company: number, employee: string) { return this.read<Dependent[]>(company, employee, '/dependents'); }

  profileSection(company: number, employee: string, section: ProfileSection) {
    return this.read<ProfileVersion>(company, employee, '/profile/' + section);
  }
  saveProfileSection(company: number, employee: string, section: ProfileSection, version: number, content: ProfileContent) {
    return this.send<ProfileVersion>(company, this.path(employee, '/profile/' + section), 'PUT', { version, content });
  }
  registrations(company: number, page: number, status?: RegistrationStatus) {
    return this.http.get<Reply<RegistrationsPage>>(this.base + '/registrations', {
      ...companyScope(company), params: { page, ...(status ? { status } : {}) },
    }).pipe(map(reply => reply.data));
  }
  registration(company: number, id: string) {
    return this.http.get<Reply<RegistrationDetails>>(this.base + '/registrations/' + encodeURIComponent(id), companyScope(company))
      .pipe(map(reply => reply.data));
  }
  saveDraft(company: number, content: Partial<EmployeeRegistration>, current?: RegistrationDetails) {
    return this.send<RegistrationDetails>(company, current ? '/registrations/' + encodeURIComponent(current.id) : '/registrations',
      current ? 'PATCH' : 'POST', current ? { version: current.version, content } : content);
  }
  registrationAction(company: number, registration: RegistrationDetails, action: 'submit' | 'approve' | 'reject', reason?: string) {
    return this.send<RegistrationDetails>(company, '/registrations/' + encodeURIComponent(registration.id) + '/' + action, 'POST',
      { version: registration.version, ...(reason ? { reason } : {}) });
  }

  rename(company: number, employee: string, body: Pick<Employee, 'firstName' | 'lastName'>) {
    return this.send<Employee>(company, this.path(employee), 'PATCH', body);
  }
  updatePersonal(company: number, employee: string, body: EmployeePersonal) {
    return this.send<EmployeePersonal>(company, this.path(employee, '/personal-info'), 'PATCH', body);
  }
  transfer(company: number, employee: string, body: EmployeeProfessional & { effectiveFrom: string; reason: string }) {
    return this.send(company, this.path(employee, '/transfers'), 'POST', body);
  }
  changeStatus(company: number, employee: string, action: 'status' | 'termination' | 'rehire',
    body: { effectiveAt: string; reason: string; status?: EmployeeStatus; terminationReason?: string }) {
    return this.send<Employee>(company, this.path(employee, '/' + action), action === 'status' ? 'PATCH' : 'POST', body);
  }
  updateBank(company: number, employee: string, body: BankAccount) {
    return this.send(company, this.path(employee, '/bank-account'), 'PUT', body);
  }
  addDependent(company: number, employee: string, body: DependentInput) {
    return this.send<Dependent>(company, this.path(employee, '/dependents'), 'POST', body);
  }
  import(company: number, employees: EmployeeRegistration[]) {
    return this.send<ImportResult>(company, '/imports', 'POST', { employees });
  }
  export(company: number, filter: EmployeeFilter) {
    return this.http.get(this.base + '/exports', {
      ...companyScope(company), params: { ...this.params(filter), format: 'csv' }, responseType: 'blob',
    });
  }

  private params({ page, limit, status, search, admittedFrom, admittedTo, departmentId, sort }: EmployeeFilter) {
    return {
      page, limit, ...(status ? { status } : {}), ...(search ? { search } : {}),
      ...(admittedFrom ? { admittedFrom } : {}), ...(admittedTo ? { admittedTo } : {}),
      ...(departmentId ? { departmentId } : {}), ...(sort ? { sort } : {}),
    };
  }
  private path(employee: string, path = '') { return '/' + encodeURIComponent(employee) + path; }
  private read<T>(company: number, employee: string, path = '') {
    return this.http.get<Reply<T>>(this.base + this.path(employee, path), companyScope(company)).pipe(map(reply => reply.data));
  }
  private send<T = unknown>(company: number, path: string, method: 'POST' | 'PATCH' | 'PUT', body: RequestBody) {
    return this.http.request<Reply<T>>(method, this.base + path, { ...companyScope(company), body }).pipe(map(reply => reply.data));
  }
}
