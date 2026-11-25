import { Routes } from '@angular/router';
import { OPERATIONS_SECTIONS } from './platform-operations.navigation';

export const PLATFORM_OPERATIONS_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'overview' },
  ...OPERATIONS_SECTIONS.map(section => ({
    path: section.path,
    title: section.title + ' · Platform operations | PRONTOEQUIPAS',
    data: { section },
    loadComponent: () => import('./operations-workspace.component').then(module => module.OperationsWorkspaceComponent),
  })),
];
