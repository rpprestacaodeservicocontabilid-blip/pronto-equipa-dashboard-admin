import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../application/auth.service';

export function requireSignIn(auth: AuthService, router: Router, returnUrl: string) {
  const page = auth.sessionUnavailable() ? '/session-unavailable' : '/signin';
  return router.createUrlTree([page], { queryParams: { returnUrl } });
}

export type AccessArea = 'identity' | 'authorization' | 'integrations' | 'platform-operations' | 'companies' | 'payments' | 'legal-rules' | 'platform-billing' | 'onboarding' | 'payslips' | 'reports' | 'ai-assistant' | 'audit' | 'support' | 'notifications' | 'subscriptions';

export function accessDeniedRoute(router: Router, area: AccessArea, returnUrl: string) {
  return router.createUrlTree(['/access-denied'], { queryParams: { area, returnUrl } });
}

export const authenticatedGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  return auth.tokens() ? true : requireSignIn(auth, inject(Router), state.url);
};

export function signInDestination(returnUrl: string | null, home: string): string {
  return returnUrl && returnUrl !== '/' && /^\/(?![/\\])/.test(returnUrl) &&
    !/^\/(signin|session-unavailable)(?:[/?#;]|$)/.test(returnUrl) ? returnUrl : home;
}

export const signInGuard: CanActivateFn = route => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const returnUrl = route.queryParamMap.get('returnUrl');
  if (auth.tokens()) return router.parseUrl(signInDestination(returnUrl, auth.homeUrl));
  return true;
};
