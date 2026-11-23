import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { accessDeniedRoute, requireSignIn } from '../../modules/auth/presentation/authenticated.guard';

export const platformGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.tokens()) return requireSignIn(auth, router, state.url);
  return auth.isPlatformAdmin() || accessDeniedRoute(router, 'companies', state.url);
};
