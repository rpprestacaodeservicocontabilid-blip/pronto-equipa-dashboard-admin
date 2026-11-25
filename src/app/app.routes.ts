import { Routes } from '@angular/router';
import { AppLayoutComponent } from './layout/shell/app-layout/app-layout.component';
import { NotFoundComponent } from './pages/other-page/not-found/not-found.component';
import { platformGuard } from './core/auth/platform.guard';
import { authenticatedGuard } from './modules/auth/presentation/authenticated.guard';
import { legalRulesGuard } from './modules/legal-rules/legal-rules.routes';
import { paymentsAccessGuard } from './modules/payments/payments-access.guard';
import { billingAccessGuard } from './modules/platform-billing/platform-billing.guard';
import { subscriptionsGuard } from './modules/subscriptions/subscriptions.routes';
import { onboardingGuard } from './modules/onboarding/onboarding.guard';
import { payslipsGuard } from './modules/payslips/payslips.guard';
import { reportsGuard } from './modules/reports/reports.routes';
import { aiAssistantGuard } from './modules/ai-assistant/ai-assistant.routes';
import { auditGuard } from './modules/audit/audit.routes';
import { supportGuard } from './modules/support/support.routes';
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
    path: 'employees', component: AppLayoutComponent, canActivate: [authenticatedGuard], canActivateChild: [authenticatedGuard],
    loadChildren: () => import('./modules/employees/employees.routes').then(module => module.EMPLOYEES_ROUTES),
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
    path: 'company-payments', component: AppLayoutComponent, canActivate: [authenticatedGuard], canActivateChild: [authenticatedGuard],
    loadChildren: () => import('./modules/payments/company-payments.routes').then(module => module.COMPANY_PAYMENTS_ROUTES),
  },
  {
    path: 'payments', component: AppLayoutComponent, canActivate: [paymentsAccessGuard],
    loadChildren: () => import('./modules/payments/payments.routes').then(module => module.PAYMENTS_ROUTES),
  },
  {
    path: 'simulations', component: AppLayoutComponent, canActivate: [authenticatedGuard], canActivateChild: [authenticatedGuard],
    loadChildren: () => import('./modules/simulations/simulations.routes').then(module => module.SIMULATIONS_ROUTES),
  },
  {
    path: 'simulation-oversight', component: AppLayoutComponent, canActivate: [platformGuard],
    children: [{ path: '', title: 'Simulation oversight | PRONTOEQUIPAS',
      loadComponent: () => import('./modules/simulations/simulation-oversight.component').then(module => module.SimulationOversightComponent) }],
  },
  {
    path: 'documents', component: AppLayoutComponent, canActivate: [authenticatedGuard], canActivateChild: [authenticatedGuard],
    loadChildren: () => import('./modules/documents/documents.routes').then(module => module.DOCUMENTS_ROUTES),
  },
  {
    path: 'document-oversight', component: AppLayoutComponent, canActivate: [platformGuard],
    children: [{ path: '', title: 'Document oversight | PRONTOEQUIPAS',
      loadComponent: () => import('./modules/documents/document-oversight.component').then(module => module.DocumentOversightComponent) }],
  },
  {
    path: 'subscriptions', component: AppLayoutComponent, canActivate: [subscriptionsGuard], canActivateChild: [subscriptionsGuard],
    loadChildren: () => import('./modules/subscriptions/subscriptions.routes').then(module => module.SUBSCRIPTIONS_ROUTES),
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
    path: 'company-payslips', component: AppLayoutComponent, canActivate: [authenticatedGuard], canActivateChild: [authenticatedGuard],
    loadChildren: () => import('./modules/payslips/company-payslips.routes').then(module => module.COMPANY_PAYSLIPS_ROUTES),
  },
  {
    path: 'payslips', component: AppLayoutComponent, canActivate: [payslipsGuard], canActivateChild: [payslipsGuard],
    loadChildren: () => import('./modules/payslips/payslips.routes').then(module => module.PAYSLIP_ROUTES),
  },
  {
    path: 'company-reports', component: AppLayoutComponent, canActivate: [authenticatedGuard], canActivateChild: [authenticatedGuard],
    loadChildren: () => import('./modules/reports/company-reports.routes').then(module => module.COMPANY_REPORT_ROUTES),
  },
  {
    path: 'reports', component: AppLayoutComponent, canActivate: [reportsGuard], canActivateChild: [reportsGuard],
    loadChildren: () => import('./modules/reports/reports.routes').then(module => module.PLATFORM_REPORT_ROUTES),
  },
  {
    path: 'ai-assistant', component: AppLayoutComponent, canActivate: [aiAssistantGuard], canActivateChild: [aiAssistantGuard],
    loadChildren: () => import('./modules/ai-assistant/ai-assistant.routes').then(module => module.AI_ASSISTANT_ROUTES),
  },
  {
    path: 'audit', component: AppLayoutComponent, canActivate: [auditGuard], canActivateChild: [auditGuard],
    loadChildren: () => import('./modules/audit/audit.routes').then(module => module.AUDIT_ROUTES),
  },
  {
    path: 'support', component: AppLayoutComponent, canActivate: [supportGuard], canActivateChild: [supportGuard],
    loadChildren: () => import('./modules/support/support.routes').then(module => module.SUPPORT_ROUTES),
  },
  {
    path: 'notifications', component: AppLayoutComponent, canActivate: [authenticatedGuard], canActivateChild: [authenticatedGuard],
    loadChildren: () => import('./modules/notifications/notifications.routes').then(module => module.NOTIFICATIONS_ROUTES),
  },
  {
    path: 'salary-structure', component: AppLayoutComponent, canActivate: [authenticatedGuard],
    loadChildren: () => import('./modules/salary-structure/salary-structure.routes').then(module => module.SALARY_STRUCTURE_ROUTES),
  },
  {
    path: '', component: AppLayoutComponent, canActivate: [platformGuard], canActivateChild: [platformGuard],
    children: [
      { path: 'companies', loadChildren: () => import('./modules/tenancy/tenancy.routes').then(m => m.TENANCY_ROUTES) },
      { path: 'tenancy', pathMatch: 'full', redirectTo: 'companies/overview' },
      { path: 'identity', loadChildren: () => import('./modules/identity/identity.routes').then(m => m.IDENTITY_ROUTES) },
      { path: 'authorization', loadChildren: () => import('./modules/authorization/authorization.routes').then(m => m.AUTHORIZATION_ROUTES) },
      { path: 'integrations', loadChildren: () => import('./modules/integrations/integrations.routes').then(m => m.INTEGRATIONS_ROUTES) },
      { path: 'platform-operations', loadChildren: () => import('./modules/platform-operations/platform-operations.routes').then(m => m.PLATFORM_OPERATIONS_ROUTES) },
    ],
  },
  { path: '**', component: NotFoundComponent, title: 'Page not found | PRONTOEQUIPAS' },
];
