import { inject } from '@angular/core';
import { ResolveFn, Routes } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { apiErrorMessage } from '../../core/api/api-error';
import { CompanyWorkspace, CompanyWorkspaceApi } from '../../core/api/company-workspace-api';
import { companyPayslipSections } from './domain/company-payslips.navigation';

export type PayslipAccess = { context: CompanyWorkspace } | { error: string };
const resolveCompany: ResolveFn<PayslipAccess> = route => {
  const id = Number(route.paramMap.get('companyId'));
  if (!Number.isInteger(id) || id < 1 || id > 2147483647) return { error: 'Select a valid company.' };
  return inject(CompanyWorkspaceApi).context(id).pipe(map(context => ({ context })),
    catchError(error => of({ error: apiErrorMessage(error) })));
};
const workspace = () => import('./presentation/company-payslips.component').then(module => module.CompanyPayslipsComponent);
export const COMPANY_PAYSLIPS_ROUTES: Routes = [
  { path: '', pathMatch: 'full', title: 'Company payslips | PRONTOEQUIPAS',
    data: { workspace: { label: 'Company payslips', path: '/company-payslips' } },
    loadComponent: () => import('../../shared/components/common/company-workspace/company-workspace-picker.component')
      .then(module => module.CompanyWorkspacePickerComponent) },
  { path: ':companyId', pathMatch: 'full', title: 'Company payslips | PRONTOEQUIPAS', resolve: { access: resolveCompany }, loadComponent: workspace },
  ...companyPayslipSections.map(section => ({ path: ':companyId/' + section.path,
    title: section.title + ' | Company payslips', data: { section }, resolve: { access: resolveCompany }, loadComponent: workspace })),
];
