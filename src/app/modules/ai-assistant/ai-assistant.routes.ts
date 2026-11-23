import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { accessDeniedRoute, requireSignIn } from '../auth/presentation/authenticated.guard';
import { AI_SECTIONS } from './domain/ai-assistant.navigation';

export const aiAssistantGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.tokens()) return requireSignIn(auth, router, state.url);
  return auth.isPlatformAdmin() || accessDeniedRoute(router, 'ai-assistant', state.url);
};

export const AI_ASSISTANT_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'overview' },
  ...AI_SECTIONS.map(section => ({
    path: section.path, title: `${section.title} · AI assistant | PRONTOEQUIPAS`, data: { section },
    loadComponent: () => import('./presentation/ai-assistant-workspace.component').then(module => module.AiAssistantWorkspaceComponent),
  })),
];
