import { inject } from '@angular/core';
import { ResolveFn, Routes } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { apiErrorMessage } from '../../core/api/api-error';
import { CompanyWorkspace, CompanyWorkspaceApi } from '../../core/api/company-workspace-api';
import { canSimulate, simulationSections } from './simulations.navigation';

export type SimulationAccess = { context: CompanyWorkspace } | { error: string };
const resolveCompany: ResolveFn<SimulationAccess> = route => {
  const id = Number(route.paramMap.get('companyId'));
  if (!Number.isInteger(id) || id < 1 || id > 2147483647) return { error: 'Select a valid company.' };
  return inject(CompanyWorkspaceApi).context(id).pipe(map(context => ({ context })),
    catchError(error => of({ error: apiErrorMessage(error) })));
};

const workspace = () => import('./simulation-workspace.component').then(module => module.SimulationWorkspaceComponent);
export const SIMULATIONS_ROUTES: Routes = [
  { path: '', pathMatch: 'full', title: 'Select company | Simulations',
    data: { workspace: { label: 'Simulations', path: '/simulations' } },
    loadComponent: () => import('../../shared/components/common/company-workspace/company-workspace-picker.component')
      .then(module => module.CompanyWorkspacePickerComponent) },
  { path: ':companyId', pathMatch: 'full', title: 'Simulations | PRONTOEQUIPAS',
    resolve: { access: resolveCompany }, loadComponent: workspace },
  ...simulationSections.map(section => ({
    path: ':companyId/' + section.path, title: section.title + ' | Simulations',
    data: { section }, resolve: { access: resolveCompany }, loadComponent: workspace,
  })),
];

export function firstSection(grants: readonly string[]) {
  return simulationSections.find(section => canSimulate(grants, ...section.grants));
}
