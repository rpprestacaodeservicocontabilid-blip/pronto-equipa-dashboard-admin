import { inject } from '@angular/core';
import { ResolveFn, Routes } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { apiErrorMessage } from '../../core/api/api-error';
import { CompanyWorkspace, CompanyWorkspaceApi } from '../../core/api/company-workspace-api';
import { PAYROLL_SECTIONS } from './domain/payroll-sections';

export type PayrollAccess = { context: CompanyWorkspace } | { error: string };

const resolveCompany: ResolveFn<PayrollAccess> = route => {
  const companyId = Number(route.paramMap.get('companyId'));
  if (!Number.isSafeInteger(companyId) || companyId < 1) return { error: 'Select a valid company.' };
  return inject(CompanyWorkspaceApi).context(companyId).pipe(
    map(context => ({ context })),
    catchError(error => of({ error: apiErrorMessage(error) })),
  );
};

const workspace = () => import('./presentation/payroll-workspace.component').then(module => module.PayrollWorkspaceComponent);

export const PAYROLL_ROUTES: Routes = [
  {
    path: '', pathMatch: 'full', title: 'Select company | Payroll',
    data: { workspace: { label: $localize`:@@ui-ghd2d6:Payroll`, path: '/payroll' } },
    loadComponent: () => import('../../shared/components/common/company-workspace/company-workspace-picker.component')
      .then(module => module.CompanyWorkspacePickerComponent),
  },
  {
    path: ':companyId', resolve: { access: resolveCompany },
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      ...PAYROLL_SECTIONS.flatMap(section => {
        const page = { title: section.title + ' | Payroll', data: { section }, loadComponent: workspace };
        const routes: Routes = [{ path: section.path, ...page }];
        if (section.create || section.view === 'periods') routes.push({ path: section.path + '/new', ...page, data: { section, create: true } });
        if (section.view === 'runs' || section.view === 'overview' || section.view === 'periods') routes.push({ path: section.path + '/:id', ...page });
        return routes;
      }),
    ],
  },
];
