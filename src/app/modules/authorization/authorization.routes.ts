import { Routes } from '@angular/router';
import { AUTHORIZATION_SECTIONS } from './authorization.navigation';

const overview = () => import('./authorization-overview.component').then(m => m.AuthorizationOverviewComponent);
const directory = () => import('./authorization-directory.component').then(m => m.AuthorizationDirectoryComponent);
const access = () => import('./authorization-user-access.component').then(m => m.AuthorizationUserAccessComponent);
export const AUTHORIZATION_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'overview' },
  ...AUTHORIZATION_SECTIONS.map(({ path, title }) => ({
    path, title: title + ' · Authorization | PRONTOEQUIPAS', data: { view: path, title },
    loadComponent: path === 'overview' ? overview : path === 'user-access' || path === 'simulator' ? access : directory,
  })),
];
