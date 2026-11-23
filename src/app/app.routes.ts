import { Routes } from '@angular/router';
import { AppLayoutComponent } from './layout/shell/app-layout/app-layout.component';
import { NotFoundComponent } from './pages/other-page/not-found/not-found.component';
import { platformGuard } from './core/auth/platform.guard';
import { authenticatedGuard } from './modules/auth/presentation/authenticated.guard';
import { legalRulesGuard } from './modules/legal-rules/legal-rules.routes';
import { paymentsAccessGuard } from './modules/payments/payments-access.guard';
import { billingAccessGuard } from './modules/platform-billing/platform-billing.guard';
import { onboardingGuard } from './modules/onboarding/onboarding.guard';
import { payslipsGuard } from './modules/payslips/payslips.guard';
import { reportsGuard } from './modules/reports/reports.routes';
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'signin' },
  { path: '', loadChildren: () => import('./modules/auth/auth.routes').then(m => m.AUTH_ROUTES) },
  {
    path: 'attendance', component: AppLayoutComponent, canActivate: [authenticatedGuard],
    loadChildren: () => import('./modules/attendance/attendance.routes').then(module => module.ATTENDANCE_ROUTES),
  },
  {
    path: 'contracts', component: AppLayoutComponent, canActivate: [authenticatedGuard],
    loadChildren: () => import('./modules/contracts/contracts.routes').then(m => m.CONTRACTS_ROUTES),
  },
  {
    path: 'leave', component: AppLayoutComponent, canActivate: [authenticatedGuard],
    loadChildren: () => import('./modules/leave/leave.routes').then(module => module.LEAVE_ROUTES),
  },
  {
    path: 'loans', component: AppLayoutComponent, canActivate: [authenticatedGuard],
    loadChildren: () => import('./modules/loans/loans.routes').then(module => module.LOANS_ROUTES),
  },
  {
    path: 'legal-rules', component: AppLayoutComponent, canActivate: [legalRulesGuard], canActivateChild: [legalRulesGuard],
    loadChildren: () => import('./modules/legal-rules/legal-rules.routes').then(module => module.LEGAL_RULES_ROUTES),
  },
  {
    path: 'organization', component: AppLayoutComponent, canActivate: [authenticatedGuard],
    loadChildren: () => import('./modules/organization/organization.routes').then(module => module.ORGANIZATION_ROUTES),
  },
  {
    path: 'payroll', component: AppLayoutComponent, canActivate: [authenticatedGuard],
    loadChildren: () => import('./modules/payroll/payroll.routes').then(module => module.PAYROLL_ROUTES),
  },
  {
    path: 'payroll-engine', component: AppLayoutComponent, canActivate: [authenticatedGuard],
    loadChildren: () => import('./modules/payroll-engine/payroll-engine.routes').then(module => module.PAYROLL_ENGINE_ROUTES),
  },
  {
    path: 'payments', component: AppLayoutComponent, canActivate: [paymentsAccessGuard],
    loadChildren: () => import('./modules/payments/payments.routes').then(module => module.PAYMENTS_ROUTES),
  },
  {
    path: 'platform-billing', component: AppLayoutComponent, canActivate: [billingAccessGuard],
    loadChildren: () => import('./modules/platform-billing/platform-billing.routes').then(module => module.PLATFORM_BILLING_ROUTES),
  },
  {
    path: 'onboarding', component: AppLayoutComponent, canActivate: [onboardingGuard], canActivateChild: [onboardingGuard],
    loadChildren: () => import('./modules/onboarding/onboarding.routes').then(module => module.ONBOARDING_ROUTES),
  },
  {
    path: 'payslips', component: AppLayoutComponent, canActivate: [payslipsGuard], canActivateChild: [payslipsGuard],
    loadChildren: () => import('./modules/payslips/payslips.routes').then(module => module.PAYSLIP_ROUTES),
  },
  {
    path: 'reports', component: AppLayoutComponent, canActivate: [reportsGuard], canActivateChild: [reportsGuard],
    loadChildren: () => import('./modules/reports/reports.routes').then(module => module.PLATFORM_REPORT_ROUTES),
  },
  {
    path: 'salary-structure', component: AppLayoutComponent, canActivate: [authenticatedGuard],
    loadChildren: () => import('./modules/salary-structure/salary-structure.routes').then(module => module.SALARY_STRUCTURE_ROUTES),
  },
  {
    path: '', component: AppLayoutComponent, canActivate: [platformGuard], canActivateChild: [platformGuard],
    children: [
      { path: 'companies', loadComponent: () => import('./pages/platform/companies/companies.component').then(m => m.CompaniesComponent), title: 'Client companies | PRONTOEQUIPAS' },
    ],
  },
  { path: '**', component: NotFoundComponent, title: 'Page not found | PRONTOEQUIPAS' },
];
