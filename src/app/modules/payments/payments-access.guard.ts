import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { accessDeniedRoute, requireSignIn } from '../auth/presentation/authenticated.guard';
import { canOpenPayments } from './domain/payment-navigation';

export const paymentsAccessGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.tokens()) return requireSignIn(auth, router, state.url);
  return canOpenPayments(auth.claims()?.permissions ?? []) || accessDeniedRoute(router, 'payments', state.url);
};
