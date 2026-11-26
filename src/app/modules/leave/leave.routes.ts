import { inject } from '@angular/core';
import { ResolveFn, Routes } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { apiErrorMessage } from '../../core/api/api-error';
import { CompanyWorkspace, CompanyWorkspaceApi } from '../../core/api/company-workspace-api';

export type LeaveAccess = { context: CompanyWorkspace } | { error: string };

const resolveCompany: ResolveFn<LeaveAccess> = route => {
  const id = Number(route.paramMap.get('companyId'));
  if (!Number.isSafeInteger(id) || id < 1) return { error: 'Select a valid company.' };
  return inject(CompanyWorkspaceApi).context(id).pipe(map(context => ({ context })),
    catchError(error => of({ error: apiErrorMessage(error) })));
};

const workspace = () => import('./presentation/leave-workspace.component').then(module => module.LeaveWorkspaceComponent);

export const LEAVE_ROUTES: Routes = [
  {
    path: '', pathMatch: 'full', title: 'Select company | Leave',
    data: { workspace: { label: $localize`:@@ui-1xf0sbk:Leave`, path: '/leave' } },
    loadComponent: () => import('../../shared/components/common/company-workspace/company-workspace-picker.component')
      .then(module => module.CompanyWorkspacePickerComponent),
  },
  { path: ':companyId', pathMatch: 'full', title: $localize`:@@ui-1xf0sbk:Leave` + ' | PRONTOEQUIPAS', resolve: { access: resolveCompany }, loadComponent: workspace },
  { path: ':companyId/:section', title: 'Leave management | PRONTOEQUIPAS', resolve: { access: resolveCompany }, loadComponent: workspace },
  { path: ':companyId/:section/:id', title: 'Leave details | PRONTOEQUIPAS', resolve: { access: resolveCompany }, loadComponent: workspace },
];
