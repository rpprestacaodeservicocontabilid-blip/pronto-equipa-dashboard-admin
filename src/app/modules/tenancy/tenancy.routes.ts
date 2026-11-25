import { Routes } from '@angular/router';
import { TENANCY_SECTIONS } from './tenancy.navigation';

export const TENANCY_ROUTES: Routes = [
  ...TENANCY_SECTIONS.map(({ path, title, status }) => ({
    path,
    pathMatch: 'full' as const,
    title: title + ' · Tenancy | PRONTOEQUIPAS',
    data: { title, status },
    loadComponent: path === 'overview'
      ? () => import('./tenancy-overview.component').then(m => m.TenancyOverviewComponent)
      : () => import('./companies.component').then(m => m.CompaniesComponent),
  })),
  {
    path: 'profile/:id',
    title: 'Company profile · Tenancy | PRONTOEQUIPAS',
    loadComponent: () => import('./company-profile.component').then(m => m.CompanyProfileComponent),
  },
];
