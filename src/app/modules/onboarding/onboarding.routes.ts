import { Routes } from '@angular/router';
import { ONBOARDING_SECTIONS } from './domain/onboarding.navigation';

export const ONBOARDING_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'overview' },
  ...ONBOARDING_SECTIONS.map(section => ({
    path: section.path,
    title: section.title + ' · Onboarding | PRONTOEQUIPAS',
    data: { section },
    loadComponent: () => import('./presentation/onboarding-page.component').then(m => m.OnboardingPageComponent),
  })),
  {
    path: 'applications/:id', title: 'Application details · Onboarding | PRONTOEQUIPAS',
    loadComponent: () => import('./presentation/application-details.component').then(m => m.ApplicationDetailsComponent),
  },
];
