import { inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ResolveFn, Routes } from '@angular/router';
import { catchError, map, of, switchMap, throwError } from 'rxjs';
import { apiErrorMessage } from '../../core/api/api-error';
import { CompanyContext } from './domain/contracts.models';
import { ContractsApi } from './infrastructure/contracts-api.service';

export type WorkspaceContext = { context: CompanyContext } | { error: string };

const resolveCompany: ResolveFn<WorkspaceContext> = route => {
  const id = Number(route.paramMap.get('companyId'));
  if (!Number.isSafeInteger(id) || id < 1) return { error: 'Select a valid company.' };
  const api = inject(ContractsApi);
  return api.context(id).pipe(
    catchError(error => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 403) return throwError(() => error);
      return api.companies().pipe(switchMap(companies => {
        const company = companies.find(entry => entry.id === id && entry.status === 'ACTIVE');
        if (!company) return throwError(() => error);
        return api.list(id, {}, 1, 1).pipe(map((): CompanyContext => ({
          company, permissions: ['contracts.read'], readOnlyFallback: true,
        })));
      }));
    }),
    map(context => ({ context })),
    catchError(error => of({ error: apiErrorMessage(error) })),
  );
};

const workspace = () => import('./presentation/workspace/contracts-workspace.component')
  .then(module => module.ContractsWorkspaceComponent);

export const CONTRACTS_ROUTES: Routes = [
  {
    path: '', pathMatch: 'full', title: 'Select company | PRONTOEQUIPAS',
    data: { workspace: { label: 'Contracts', path: '/contracts' } },
    loadComponent: () => import('../../shared/components/common/company-workspace/company-workspace-picker.component')
      .then(module => module.CompanyWorkspacePickerComponent),
  },
  {
    path: ':companyId', pathMatch: 'full', title: 'Contracts | PRONTOEQUIPAS',
    loadComponent: workspace, resolve: { access: resolveCompany },
  },
  {
    path: ':companyId/new', title: 'New contract | PRONTOEQUIPAS',
    loadComponent: workspace, resolve: { access: resolveCompany }, data: { mode: 'create' },
  },
  {
    path: ':companyId/details/:id/edit', title: 'Edit draft | PRONTOEQUIPAS',
    loadComponent: workspace, resolve: { access: resolveCompany }, data: { mode: 'edit' },
  },
  {
    path: ':companyId/details/:id', title: 'Contract details | PRONTOEQUIPAS',
    loadComponent: workspace, resolve: { access: resolveCompany }, data: { mode: 'detail' },
  },
  {
    path: ':companyId/:section', title: 'Manage contracts | PRONTOEQUIPAS',
    loadComponent: workspace, resolve: { access: resolveCompany },
  },
];
