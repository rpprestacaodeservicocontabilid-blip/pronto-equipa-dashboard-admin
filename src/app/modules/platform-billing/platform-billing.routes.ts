import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { BILLING_SECTIONS, firstBillingSection } from './domain/billing-navigation';
import { billingSectionGuard } from './platform-billing.guard';

export const PLATFORM_BILLING_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: () => {
    const auth = inject(AuthService);
    return firstBillingSection(auth.claims()?.permissions ?? [], auth.isPlatformAdmin())?.path ?? 'overview';
  } },
  ...BILLING_SECTIONS.map(section => ({
    path: section.path, title: section.title + ' | Platform billing', data: { section },
    canActivate: [billingSectionGuard],
    loadComponent: () => import('./presentation/billing-workspace.component').then(module => module.BillingWorkspaceComponent),
  })),
];
