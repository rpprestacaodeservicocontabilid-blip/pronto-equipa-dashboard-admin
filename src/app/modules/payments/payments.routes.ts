import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, Routes } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { accessDeniedRoute, requireSignIn } from '../auth/presentation/authenticated.guard';
import { canOpenPaymentSection, PAYMENT_SECTIONS } from './domain/payment-navigation';

export const PAYMENTS_ROUTES: Routes = [
  {
    path: '', pathMatch: 'full',
    redirectTo: () => {
      const auth = inject(AuthService);
      const router = inject(Router);
      if (!auth.tokens()) return requireSignIn(auth, router, '/payments');
      const permissions = auth.claims()?.permissions ?? [];
      const section = PAYMENT_SECTIONS.find(item => canOpenPaymentSection(item, permissions));
      return section ? router.createUrlTree(['/payments', section.path]) : accessDeniedRoute(router, 'payments', '/payments');
    },
  },
  ...PAYMENT_SECTIONS.map(section => ({
    path: section.path,
    title: section.title + ' | Payments',
    data: { section },
    canActivate: [(_route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => canOpenPaymentSection(section, inject(AuthService).claims()?.permissions ?? [])
      || accessDeniedRoute(inject(Router), 'payments', state.url)],
    loadComponent: () => import('./presentation/payments-workspace.component').then(module => module.PaymentsWorkspaceComponent),
  })),
];
