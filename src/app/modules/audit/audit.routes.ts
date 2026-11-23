import { inject } from '@angular/core';
import { CanActivateFn, Route, Router, Routes } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { accessDeniedRoute, requireSignIn } from '../auth/presentation/authenticated.guard';
import { AUDIT_SECTIONS, canOpenAudit } from './domain/audit.navigation';

export const auditGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.tokens()) return requireSignIn(auth, router, state.url);
  return canOpenAudit(auth.claims()?.permissions ?? []) || accessDeniedRoute(router, 'audit', state.url);
};

export const AUDIT_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: () => {
    const grants = inject(AuthService).claims()?.permissions ?? [];
    return AUDIT_SECTIONS.find(section => grants.includes(section.permission))?.path ?? 'overview';
  } },
  ...AUDIT_SECTIONS.map((section): Route => ({
    path: section.path,
    title: section.title + ' · Audit | PRONTOEQUIPAS',
    data: { section },
    canActivate: [(_route, state) =>
      inject(AuthService).claims()?.permissions.includes(section.permission) ||
      accessDeniedRoute(inject(Router), 'audit', state.url)],
    loadComponent: section.view === 'managed' || section.view === 'metrics'
      ? () => import('./presentation/audit-management.component').then(module => module.AuditManagementComponent)
      : () => import('./presentation/audit-explorer.component').then(module => module.AuditExplorerComponent),
  })),
];
