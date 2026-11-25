import { inject } from '@angular/core';
import { ResolveFn, Routes } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { apiErrorMessage } from '../../core/api/api-error';
import { CompanyWorkspace, CompanyWorkspaceApi } from '../../core/api/company-workspace-api';
import { companyReportSections } from './domain/company-reports.navigation';

export type ReportWorkspaceAccess = { context: CompanyWorkspace } | { error: string };
const resolveCompany: ResolveFn<ReportWorkspaceAccess> = route => {
  const id = Number(route.paramMap.get('companyId'));
  if (!Number.isInteger(id) || id < 1 || id > 2147483647) return { error: 'Select a valid company.' };
  return inject(CompanyWorkspaceApi).context(id).pipe(map(context => ({ context })),
    catchError(error => of({ error: apiErrorMessage(error) })));
};
const workspace = () => import('./presentation/company-reports.component').then(module => module.CompanyReportsComponent);

export const COMPANY_REPORT_ROUTES: Routes = [
  { path: '', pathMatch: 'full', title: 'Company reports | PRONTOEQUIPAS',
    data: { workspace: { label: 'Company reports', path: '/company-reports' } },
    loadComponent: () => import('../../shared/components/common/company-workspace/company-workspace-picker.component')
      .then(module => module.CompanyWorkspacePickerComponent) },
  { path: ':companyId', pathMatch: 'full', title: 'Company reports | PRONTOEQUIPAS',
    resolve: { access: resolveCompany }, loadComponent: workspace },
  ...companyReportSections.map(section => ({
    path: ':companyId/' + section.path, title: section.title + ' | Company reports',
    data: { section }, resolve: { access: resolveCompany }, loadComponent: workspace,
  })),
];
