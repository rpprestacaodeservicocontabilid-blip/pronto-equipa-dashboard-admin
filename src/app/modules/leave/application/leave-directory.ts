import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Subject, catchError, forkJoin, map, of, startWith, switchMap } from 'rxjs';
import { CompanyWorkspace } from '../../../core/api/company-workspace-api';
import { EmployeeReference, OrganizationReference } from '../domain/leave.models';
import { employeeLabel } from '../domain/leave-rules';
import { LeaveApi } from '../infrastructure/leave-api.service';

@Injectable()
export class LeaveDirectory {
  private readonly api = inject(LeaveApi);
  private readonly contexts = new Subject<CompanyWorkspace>();
  private readonly empty = { employees: [] as EmployeeReference[], departments: [] as OrganizationReference[], sites: [] as OrganizationReference[], ready: false };
  private readonly data = toSignal(this.contexts.pipe(switchMap(context => {
    const id = context.company.id;
    const grants = context.permissions;
    return forkJoin({
      employees: grants.includes('employees.read') ? this.api.employees(id).pipe(catchError(() => of([]))) : of([]),
      departments: grants.includes('organization:read') ? this.api.references(id, 'departments').pipe(catchError(() => of([]))) : of([]),
      sites: grants.includes('organization:read') ? this.api.references(id, 'establishments').pipe(catchError(() => of([]))) : of([]),
    }).pipe(map(data => ({ ...data, ready: true })), startWith(this.empty));
  })), { initialValue: this.empty });

  readonly employees = computed(() => this.data().employees);
  readonly ready = computed(() => this.data().ready);
  readonly sites = computed(() => this.data().sites);
  private readonly byId = computed(() => new Map(this.employees().map(employee => [employee.id, employee])));
  private readonly departmentById = computed(() => new Map(this.data().departments.map(entry => [String(entry.id), entry])));
  readonly departments = computed(() => [...new Set(this.employees().flatMap(employee => employee.departmentId == null ? [] : [String(employee.departmentId)]))]
    .map(id => ({ id, name: this.departmentById().get(id)?.name ?? 'Department #' + id }))
    .sort((a, b) => a.name.localeCompare(b.name)));

  load(context: CompanyWorkspace) { this.contexts.next(context); }
  employee(id: string) { return this.byId().get(id); }
  name(id: string) { return employeeLabel(this.employee(id), id); }
  department(id: string) {
    const department = this.employee(id)?.departmentId;
    return department == null ? '—' : this.departmentById().get(String(department))?.name ?? 'Department #' + department;
  }
  matches(id: string, department: string, employee = '') {
    return (!employee || employee === id) && (!department || String(this.employee(id)?.departmentId) === department);
  }
}
