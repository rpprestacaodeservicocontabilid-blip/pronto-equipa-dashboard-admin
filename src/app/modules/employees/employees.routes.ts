import { inject } from '@angular/core';
import { ResolveFn, Routes } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { CompanyWorkspace, CompanyWorkspaceApi } from '../../core/api/company-workspace-api';
import { apiErrorMessage } from '../../core/api/api-error';
import { EMPLOYEE_PROFILE, EMPLOYEE_SECTIONS, EmployeeSection } from './domain/employee-navigation';

export type EmployeeAccess = { context: CompanyWorkspace } | { error: string };
const access: ResolveFn<EmployeeAccess> = route => {
  const id = Number(route.paramMap.get('companyId'));
  if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) return { error: 'Select a valid company.' };
  return inject(CompanyWorkspaceApi).context(id).pipe(map(context => ({ context })),
    catchError(error => of({ error: apiErrorMessage(error) })));
};
const workspace = () => import('./presentation/employee-workspace.component').then(m => m.EmployeeWorkspaceComponent);
const sectionRoute = (path: string, section: EmployeeSection) => ({
  path, pathMatch: 'full' as const, title: section.title + ' · Employees | PRONTOEQUIPAS',
  data: { section }, resolve: { access }, loadComponent: workspace,
});
export const EMPLOYEES_ROUTES: Routes = [
  {
    path: '', pathMatch: 'full', title: 'Employees | PRONTOEQUIPAS',
    data: { workspace: { label: 'Employees', path: '/employees' } },
    loadComponent: () => import('../../shared/components/common/company-workspace/company-workspace-picker.component')
      .then(m => m.CompanyWorkspacePickerComponent),
  },
  { path: ':companyId', pathMatch: 'full', redirectTo: ':companyId/overview' },
  ...EMPLOYEE_SECTIONS.map(section => sectionRoute(':companyId/' + section.path, section)),
  ...EMPLOYEE_PROFILE.map(section => sectionRoute(':companyId/details/:employeeId' + (section.path ? '/' + section.path : ''), section)),
];
