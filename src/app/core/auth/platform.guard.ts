import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { accessDeniedRoute, requireSignIn } from '../../modules/auth/presentation/authenticated.guard';

export const platformGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.tokens()) return requireSignIn(auth, router, state.url);
  const section = router.parseUrl(state.url).root.children['primary']?.segments[0]?.path;
  const area = section === 'identity' || section === 'authorization' || section === 'integrations' ||
    section === 'platform-operations' ? section : 'companies';
  return auth.isPlatformAdmin() || accessDeniedRoute(router, area, state.url);
};
