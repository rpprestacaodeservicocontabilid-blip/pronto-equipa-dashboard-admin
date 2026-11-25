import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { accessDeniedRoute, requireSignIn } from '../auth/presentation/authenticated.guard';
import { subscriptionSections } from './subscriptions.navigation';

export const subscriptionsGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.tokens()) return requireSignIn(auth, router, state.url);
  return auth.isPlatformAdmin() || accessDeniedRoute(router, 'subscriptions', state.url);
};

export const SUBSCRIPTIONS_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'overview' },
  ...subscriptionSections.map(section => ({
    path: section.path, title: section.title + ' | PRONTOEQUIPAS', data: { section },
    loadComponent: () => import('./subscriptions-workspace.component').then(module => module.SubscriptionsWorkspaceComponent),
  })),
];
