import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot, Routes } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { accessDeniedRoute, requireSignIn } from '../auth/presentation/authenticated.guard';
import { canOpenLegalSection, LEGAL_READ, LEGAL_SECTIONS } from './domain/legal-navigation';

export const legalRulesGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.tokens()) return requireSignIn(auth, router, state.url);
  return auth.claims()?.permissions.includes(LEGAL_READ) || accessDeniedRoute(router, 'legal-rules', state.url);
};

const workspace = () => import('./presentation/legal-workspace.component').then(module => module.LegalWorkspaceComponent);
const editor = () => import('./presentation/legal-version.component').then(module => module.LegalVersionComponent);

export const LEGAL_RULES_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'overview' },
  { path: 'rule-sets/new', loadComponent: editor, title: 'New rule set | Legal rules' },
  { path: 'rule-sets/:id', loadComponent: editor, title: 'Rule set version | Legal rules' },
  ...LEGAL_SECTIONS.map(section => ({
    path: section.path,
    title: section.title + ' | Legal rules',
    canActivate: [(_route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => canOpenLegalSection(section, inject(AuthService).claims()?.permissions ?? [])
      || accessDeniedRoute(inject(Router), 'legal-rules', state.url)],
    loadComponent: workspace,
    data: { section },
  })),
];
