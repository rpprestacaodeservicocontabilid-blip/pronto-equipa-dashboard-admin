import { inject } from '@angular/core';
import { ResolveFn, Routes } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { apiErrorMessage } from '../../core/api/api-error';
import { CompanyWorkspace, CompanyWorkspaceApi } from '../../core/api/company-workspace-api';
import { LOAN_SECTIONS } from './domain/loans-sections';

export type LoansAccess = { context: CompanyWorkspace } | { error: string };

const resolveCompany: ResolveFn<LoansAccess> = route => {
  const company = Number(route.paramMap.get('companyId'));
  if (!Number.isSafeInteger(company) || company < 1) return { error: 'Select a valid company.' };
  return inject(CompanyWorkspaceApi).context(company).pipe(
    map(context => ({ context })),
    catchError(error => of({ error: apiErrorMessage(error) })),
  );
};

const workspace = () => import('./presentation/loans-workspace.component').then(m => m.LoansWorkspaceComponent);

export const LOANS_ROUTES: Routes = [
  {
    path: '', pathMatch: 'full', title: 'Select company | Loans',
    data: { workspace: { label: $localize`:@@ui-jklrbs:Loans`, path: '/loans' } },
    loadComponent: () => import('../../shared/components/common/company-workspace/company-workspace-picker.component')
      .then(module => module.CompanyWorkspacePickerComponent),
  },
  {
    path: ':companyId', resolve: { access: resolveCompany },
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      ...LOAN_SECTIONS.flatMap(section => {
        const route = { title: section.title + ' | Loans', data: { section }, loadComponent: workspace };
        return [
          { path: section.path, ...route },
          ...(section.detail ? [{ path: section.path + '/:id', ...route }] : []),
        ];
      }),
    ],
  },
];
