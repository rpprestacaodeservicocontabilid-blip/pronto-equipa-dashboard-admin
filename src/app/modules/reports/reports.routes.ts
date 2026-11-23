import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { accessDeniedRoute, requireSignIn } from '../auth/presentation/authenticated.guard';
import { REPORT_SECTIONS } from './domain/platform-reports.navigation';

export const reportsGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.tokens()) return requireSignIn(auth, router, state.url);
  return auth.isPlatformAdmin() || accessDeniedRoute(router, 'reports', state.url);
};

export const PLATFORM_REPORT_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'overview' },
  ...REPORT_SECTIONS.map(section => ({
    path: section.path, title: section.title + ' · Reports | PRONTOEQUIPAS', data: { section },
    loadComponent: ['overview', 'catalog', 'analysis'].includes(section.view)
      ? () => import('./presentation/report-explorer.component').then(m => m.ReportExplorerComponent)
      : () => import('./presentation/report-management.component').then(m => m.ReportManagementComponent),
  })),
];
