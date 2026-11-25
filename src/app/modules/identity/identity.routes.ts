import { Routes } from '@angular/router';

const workspace = () => import('./identity-admin.component').then(module => module.IdentityAdminComponent);
export const IDENTITY_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'users' },
  { path: 'users', title: 'User directory | PRONTOEQUIPAS', loadComponent: workspace },
  { path: 'disabled', title: 'Administratively disabled | PRONTOEQUIPAS', data: { disabled: true }, loadComponent: workspace },
];
