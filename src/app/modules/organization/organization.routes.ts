import { inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ResolveFn, Routes } from '@angular/router';
import { catchError, map, of, switchMap, throwError } from 'rxjs';
import { organizationErrorMessage } from './presentation/organization-display';
import { CompanyWorkspace, CompanyWorkspaceApi } from '../../core/api/company-workspace-api';
import { OrganizationApi } from './infrastructure/organization-api.service';

export type OrganizationAccess = { context: CompanyWorkspace; readOnly?: boolean } | { error: string };

const resolveCompany: ResolveFn<OrganizationAccess> = route => {
  const id = Number(route.paramMap.get('companyId'));
  if (!Number.isSafeInteger(id) || id < 1) return { error: $localize`:@@organization-select-a-valid-company:Select a valid company.` };
  const workspace = inject(CompanyWorkspaceApi);
  const api = inject(OrganizationApi);
  return workspace.context(id).pipe(
    map(context => ({ context } as OrganizationAccess)),
    catchError(error => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 403) return throwError(() => error);
      return workspace.companies().pipe(switchMap(companies => {
        const company = companies.find(entry => entry.id === id && entry.status === 'ACTIVE');
        if (!company) return throwError(() => error);
        return api.page(id, 'departments', {}, 1, 1).pipe(map(() => ({
          context: { company, permissions: ['organization:read'] }, readOnly: true,
        })));
      }));
    }),
    catchError(error => of({ error: organizationErrorMessage(error) })),
  );
};

const workspace = () => import('./presentation/organization-workspace.component').then(module => module.OrganizationWorkspaceComponent);

export const ORGANIZATION_ROUTES: Routes = [
  {
    path: '', pathMatch: 'full', title: $localize`:@@organization-select-company:Select company` + ' | ' + $localize`:@@organization-organization:Organization`,
    data: { workspace: { label: $localize`:@@organization-organization:Organization`, path: '/organization' } },
    loadComponent: () => import('../../shared/components/common/company-workspace/company-workspace-picker.component')
      .then(module => module.CompanyWorkspacePickerComponent),
  },
  { path: ':companyId', pathMatch: 'full', title: $localize`:@@organization-organization:Organization` + ' | PRONTOEQUIPAS', resolve: { access: resolveCompany }, loadComponent: workspace },
  { path: ':companyId/:section', title: $localize`:@@organization-manage-organization:Manage organization` + " | PRONTOEQUIPAS", resolve: { access: resolveCompany }, loadComponent: workspace },
  { path: ':companyId/:section/:id', title: $localize`:@@organization-organization-details:Organization details` + " | PRONTOEQUIPAS", resolve: { access: resolveCompany }, loadComponent: workspace },
];
