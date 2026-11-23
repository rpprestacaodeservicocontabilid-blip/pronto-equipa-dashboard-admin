import { inject } from '@angular/core';
import { CanActivateFn, Route, Router, Routes } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { accessDeniedRoute, requireSignIn } from '../auth/presentation/authenticated.guard';
import { SUPPORT_ACCESS, SUPPORT_SECTIONS, supportGrant } from './domain/support.navigation';

export const supportGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.tokens()) return requireSignIn(auth, router, state.url);
  return auth.claims()?.permissions.includes(SUPPORT_ACCESS) || accessDeniedRoute(router, 'support', state.url);
};
const sectionAccess = (permission: string): CanActivateFn => (_route, state) =>
  inject(AuthService).claims()?.permissions.includes(supportGrant(permission)) || accessDeniedRoute(inject(Router), 'support', state.url);

export const SUPPORT_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: () => {
    const grants = inject(AuthService).claims()?.permissions ?? [];
    return SUPPORT_SECTIONS.find(section => grants.includes(supportGrant(section.permission)))?.path ?? 'overview';
  } },
  { path: 'tickets/:id', title: 'Ticket details · Support | PRONTOEQUIPAS', canActivate: [sectionAccess('tickets:read-team')],
    loadComponent: () => import('./presentation/support-ticket.component').then(module => module.SupportTicketComponent) },
  ...SUPPORT_SECTIONS.map((section): Route => ({
    path: section.path, title: section.title + ' · Support | PRONTOEQUIPAS', data: { section },
    canActivate: [sectionAccess(section.permission)],
    loadComponent: () => import('./presentation/support-section.component').then(module => module.SupportSectionComponent),
  })),
];
