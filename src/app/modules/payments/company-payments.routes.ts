import { inject } from '@angular/core';
import { ResolveFn, Routes } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { apiErrorMessage } from '../../core/api/api-error';
import { CompanyWorkspace, CompanyWorkspaceApi } from '../../core/api/company-workspace-api';
import { companyPaymentSections } from './domain/company-payments.navigation';

export type CompanyPaymentContext = { context: CompanyWorkspace } | { error: string };
const resolveCompany: ResolveFn<CompanyPaymentContext> = route => {
  const id = Number(route.paramMap.get('companyId'));
  if (!Number.isInteger(id) || id < 1 || id > 2147483647) return { error: 'Select a valid company.' };
  return inject(CompanyWorkspaceApi).context(id).pipe(map(context => ({ context })),
    catchError(error => of({ error: apiErrorMessage(error) })));
};
const workspace = () => import('./presentation/company-payments.component').then(module => module.CompanyPaymentsComponent);
export const COMPANY_PAYMENTS_ROUTES: Routes = [
  { path: '', pathMatch: 'full', title: $localize`:@@ui-inyz63:Company payments` + ' | PRONTOEQUIPAS',
    data: { workspace: { label: $localize`:@@ui-inyz63:Company payments`, path: '/company-payments' } },
    loadComponent: () => import('../../shared/components/common/company-workspace/company-workspace-picker.component')
      .then(module => module.CompanyWorkspacePickerComponent) },
  { path: ':companyId', pathMatch: 'full', title: $localize`:@@ui-inyz63:Company payments` + ' | PRONTOEQUIPAS', resolve: { access: resolveCompany }, loadComponent: workspace },
  ...companyPaymentSections.map(section => ({ path: ':companyId/' + section.path,
    title: section.title + ' | Company payments', data: { section }, resolve: { access: resolveCompany }, loadComponent: workspace })),
];
