import { inject } from '@angular/core';
import { ResolveFn, Routes } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { apiErrorMessage } from '../../core/api/api-error';
import { CompanyWorkspace, CompanyWorkspaceApi } from '../../core/api/company-workspace-api';
import { ENGINE_SECTIONS } from './domain/engine-access';

export type EngineAccess = { context: CompanyWorkspace } | { error: string };

const companyAccess: ResolveFn<EngineAccess> = route => {
  const id = Number(route.paramMap.get('companyId'));
  if (!Number.isSafeInteger(id) || id < 1) return { error: 'Select a valid company.' };
  return inject(CompanyWorkspaceApi).context(id).pipe(
    map(context => context.company.status === 'ACTIVE' ? { context } : { error: 'Select an active company.' }),
    catchError(error => of({ error: apiErrorMessage(error) })),
  );
};

const workspace = () => import('./presentation/engine-workspace.component').then(module => module.EngineWorkspaceComponent);

export const PAYROLL_ENGINE_ROUTES: Routes = [
  {
    path: '', pathMatch: 'full', title: 'Select company | Payroll engine',
    data: { workspace: { label: 'Payroll engine', path: '/payroll-engine' } },
    loadComponent: () => import('../../shared/components/common/company-workspace/company-workspace-picker.component')
      .then(module => module.CompanyWorkspacePickerComponent),
  },
  {
    path: ':companyId', resolve: { access: companyAccess },
    children: [
      { path: '', pathMatch: 'full', title: 'Payroll engine', loadComponent: workspace },
      ...ENGINE_SECTIONS.map(section => ({
        path: section.id, title: section.title + ' | Payroll engine', loadComponent: workspace, data: { section },
      })),
    ],
  },
];
