import { inject } from '@angular/core';
import { ResolveFn, Routes } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { apiErrorMessage } from '../../core/api/api-error';
import { CompanyWorkspace, CompanyWorkspaceApi } from '../../core/api/company-workspace-api';
import { sections } from './documents.navigation';

export type Access = { context: CompanyWorkspace } | { error: string };
const resolveCompany: ResolveFn<Access> = route => {
  const companyId = Number(route.paramMap.get('companyId'));
  if (!Number.isInteger(companyId) || companyId < 1 || companyId > 2147483647) return { error: 'Select a valid company.' };
  return inject(CompanyWorkspaceApi).context(companyId).pipe(map(context => ({ context })),
    catchError(error => of({ error: apiErrorMessage(error) })));
};
const workspace = () => import('./documents-workspace.component').then(module => module.DocumentsWorkspaceComponent);
export const DOCUMENTS_ROUTES: Routes = [
  { path: '', pathMatch: 'full', title: $localize`:@@ui-dgxfdq:Select company` + ' | PRONTOEQUIPAS',
    data: { workspace: { label: $localize`:@@ui-oz47lx:Documents`, path: '/documents' } },
    loadComponent: () => import('../../shared/components/common/company-workspace/company-workspace-picker.component')
      .then(module => module.CompanyWorkspacePickerComponent) },
  { path: ':companyId', pathMatch: 'full', redirectTo: ':companyId/library' },
  ...sections.map(section => ({ path: ':companyId/' + section.path, title: section.title + ' | PRONTOEQUIPAS',
    data: { section }, resolve: { access: resolveCompany }, loadComponent: workspace })),
];
