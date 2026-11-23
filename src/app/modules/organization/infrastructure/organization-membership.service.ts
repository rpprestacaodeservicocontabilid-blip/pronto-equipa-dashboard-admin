import { Injectable, inject } from '@angular/core';
import { Observable, from, map, mergeMap, of, reduce } from 'rxjs';
import { OrganizationApi, childCollection } from './organization-api.service';

@Injectable({ providedIn: 'root' })
export class OrganizationMembership {
  private readonly organization = inject(OrganizationApi);

  employees(company: number, departments: string[] | null, date = new Date().toISOString().slice(0, 10)): Observable<Set<string> | null> {
    if (!departments) return of(null);
    return from(departments).pipe(
      mergeMap(id => this.organization.all(company, childCollection('departments', id, 'employees'), { status: 'ACTIVE' }), 4),
      map(rows => rows.filter(row => row.employeeId && (!row.effectiveFrom || row.effectiveFrom <= date)
        && (!row.effectiveTo || row.effectiveTo >= date))),
      reduce((employees, rows) => { for (const row of rows) employees.add(row.employeeId!); return employees; }, new Set<string>()),
    );
  }
}
