import { Routes } from '@angular/router';
import { AppLayoutComponent } from './layout/shell/app-layout/app-layout.component';
import { SignInComponent } from './pages/auth-pages/sign-in/sign-in.component';
import { NotFoundComponent } from './pages/other-page/not-found/not-found.component';
import { platformGuard } from './core/auth/platform.guard';
export const routes: Routes = [
  { path: 'signin', component: SignInComponent, title: 'Sign in | PRONTOEQUIPAS' },
  {
    path: '', component: AppLayoutComponent, canActivate: [platformGuard], canActivateChild: [platformGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'companies' },
      { path: 'companies', loadComponent: () => import('./pages/platform/companies/companies.component').then(m => m.CompaniesComponent), title: 'Client companies | PRONTOEQUIPAS' },
    ],
  },
  { path: '**', component: NotFoundComponent, title: 'Page not found | PRONTOEQUIPAS' },
];
