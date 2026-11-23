import { inject } from '@angular/core';
import { ResolveFn, Routes } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { apiErrorMessage } from '../../core/api/api-error';
import { CompanyWorkspace, CompanyWorkspaceApi } from '../../core/api/company-workspace-api';
import { SECTIONS } from './domain/salary-sections';

export type SalaryAccess = { context: CompanyWorkspace } | { error: string };
const resolveCompany: ResolveFn<SalaryAccess> = route => {
  const company = Number(route.paramMap.get('companyId'));
  if (!Number.isSafeInteger(company) || company < 1) return { error: 'Select a valid company.' };
  return inject(CompanyWorkspaceApi).context(company).pipe(map(context => ({ context })),
    catchError(error => of({ error: apiErrorMessage(error) })));
};
const workspace = () => import('./presentation/salary-workspace.component').then(m => m.SalaryWorkspaceComponent);
export const SALARY_STRUCTURE_ROUTES: Routes = [
  {
    path: '', pathMatch: 'full', title: 'Select company | Salary structure',
    data: { workspace: { label: 'Salary structure', path: '/salary-structure' } },
    loadComponent: () => import('../../shared/components/common/company-workspace/company-workspace-picker.component')
      .then(m => m.CompanyWorkspacePickerComponent),
  },
  {
    path: ':companyId', resolve: { access: resolveCompany }, children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      ...SECTIONS.flatMap(section => {
        const route = { title: section.title + ' | Salary structure', data: { section }, loadComponent: workspace };
        return [{ path: section.path, ...route }, ...(section.detail ? [{ path: section.path + '/:id', ...route }] : [])];
      }),
    ],
  },
];
