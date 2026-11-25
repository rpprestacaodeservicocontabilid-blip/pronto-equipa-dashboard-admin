import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { accessDeniedRoute, requireSignIn } from '../auth/presentation/authenticated.guard';
import { BillingSection, canReadBilling, firstBillingSection } from './domain/billing-navigation';

export const billingAccessGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.tokens()) return requireSignIn(auth, router, state.url);
  return Boolean(firstBillingSection(auth.claims()?.permissions ?? [], auth.isPlatformAdmin())) ||
    accessDeniedRoute(router, 'platform-billing', state.url);
};

export const billingSectionGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.tokens()) return requireSignIn(auth, router, state.url);
  return canReadBilling(route.data['section'] as BillingSection, auth.claims()?.permissions ?? [], auth.isPlatformAdmin()) ||
    accessDeniedRoute(router, 'platform-billing', state.url);
};
