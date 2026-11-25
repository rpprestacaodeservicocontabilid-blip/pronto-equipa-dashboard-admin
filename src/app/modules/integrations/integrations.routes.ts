import { Routes } from '@angular/router';
import { INTEGRATION_SECTIONS } from './integrations.navigation';

export const INTEGRATIONS_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'overview' },
  ...INTEGRATION_SECTIONS.map(section => ({
    path: section.path, data: { section }, title: section.title + ' · Integrations | PRONTOEQUIPAS',
    loadComponent: () => import('./integrations-workspace.component').then(module => module.IntegrationsWorkspaceComponent),
  })),
];
