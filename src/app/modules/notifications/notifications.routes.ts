import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { accessDeniedRoute } from '../auth/presentation/authenticated.guard';
import { NOTIFICATIONS_ACCESS, NOTIFICATION_SECTIONS, notificationGrant } from './domain/notifications.navigation';

const adminAccess = (permission: string): CanActivateFn => (_route, state) => {
  const permissions = inject(AuthService).claims()?.permissions ?? [];
  return (permissions.includes(NOTIFICATIONS_ACCESS) && permissions.includes(notificationGrant(permission))) ||
    accessDeniedRoute(inject(Router), 'notifications', state.url);
};

export const NOTIFICATIONS_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'inbox' },
  ...['inbox', 'preferences'].map(path => ({
    path, title: (path === 'inbox' ? 'My notifications' : 'Notification preferences') + ' | PRONTOEQUIPAS',
    data: { preferences: path === 'preferences' },
    loadComponent: () => import('./presentation/notification-inbox.component').then(module => module.NotificationInboxComponent),
  })),
  ...NOTIFICATION_SECTIONS.map(section => ({
    path: section.path, title: section.title + ' | PRONTOEQUIPAS',
    data: { section }, canActivate: [adminAccess(section.permission)],
    loadComponent: () => import('./presentation/notification-admin.component').then(module => module.NotificationAdminComponent),
  })),
];
