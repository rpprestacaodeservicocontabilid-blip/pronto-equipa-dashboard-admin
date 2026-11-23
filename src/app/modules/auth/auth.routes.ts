import { Routes } from '@angular/router';
import { authenticatedGuard, signInGuard } from './presentation/authenticated.guard';

export const AUTH_ROUTES: Routes = [
  { path: 'signin', canActivate: [signInGuard], loadComponent: () => import('../../pages/auth-pages/sign-in/sign-in.component').then(m => m.SignInComponent), title: 'Sign in | PRONTOEQUIPAS' },
  { path: 'session-unavailable', loadComponent: () => import('./presentation/session-unavailable.component').then(m => m.SessionUnavailableComponent), title: 'Reconnect | PRONTOEQUIPAS' },
  { path: 'signup', loadComponent: () => import('../../pages/auth-pages/sign-up/sign-up.component').then(m => m.SignUpComponent), title: 'Sign up | PRONTOEQUIPAS' },
  { path: 'forgot-password', loadComponent: () => import('./presentation/password/forgot-password.component').then(m => m.ForgotPasswordComponent), title: 'Forgot password | PRONTOEQUIPAS' },
  { path: 'reset-password', loadComponent: () => import('./presentation/password/reset-password.component').then(m => m.ResetPasswordComponent), title: 'Reset password | PRONTOEQUIPAS' },
  { path: 'verify-email', loadComponent: () => import('./presentation/verification/verify-email.component').then(m => m.VerifyEmailComponent), title: 'Verify email | PRONTOEQUIPAS' },
  { path: 'oauth/callback', loadComponent: () => import('./presentation/oauth-callback.component').then(m => m.OAuthCallbackComponent), title: 'Google sign in | PRONTOEQUIPAS' },
  { path: 'access-denied', loadComponent: () => import('./presentation/access-denied.component').then(m => m.AccessDeniedComponent), title: 'Access required | PRONTOEQUIPAS' },
  {
    path: 'account',
    loadComponent: () => import('../../layout/shell/app-layout/app-layout.component').then(m => m.AppLayoutComponent),
    canActivate: [authenticatedGuard],
    canActivateChild: [authenticatedGuard],
    children: [
      {
        path: 'security',
        loadComponent: () => import('./presentation/security/account-security.component').then(m => m.AccountSecurityComponent),
        title: 'Account security | PRONTOEQUIPAS',
      },
    ],
  },
];
