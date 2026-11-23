import { Routes } from '@angular/router';
import { BILLING_SECTIONS } from './domain/billing-navigation';

export const PLATFORM_BILLING_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'overview' },
  ...BILLING_SECTIONS.map(section => ({
    path: section.path, title: section.title + ' | Platform billing', data: { section },
    loadComponent: () => import('./presentation/billing-workspace.component').then(module => module.BillingWorkspaceComponent),
  })),
];
