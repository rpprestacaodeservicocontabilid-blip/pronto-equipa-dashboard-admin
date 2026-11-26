import { ATTENDANCE_SECTIONS, can as canAttend } from '../modules/attendance/domain/attendance.sections';
import { CONTRACT_VIEWS } from '../modules/contracts/domain/contracts.models';
import { LEAVE_SECTIONS } from '../modules/leave/domain/leave-sections';
import { canOpenLegalSection, LEGAL_READ, LEGAL_SECTIONS } from '../modules/legal-rules/domain/legal-navigation';
import { LOAN_SECTIONS, canOpen } from '../modules/loans/domain/loans-sections';
import { ORGANIZATION_NAVIGATION } from '../modules/organization/domain/organization-navigation';
import { canOpenPayments, canOpenPaymentSection, PAYMENT_SECTIONS } from '../modules/payments/domain/payment-navigation';
import { companyPaymentAccess, companyPaymentSections } from '../modules/payments/domain/company-payments.navigation';
import { BILLING_SECTIONS, canReadBilling, firstBillingSection } from '../modules/platform-billing/domain/billing-navigation';
import { subscriptionSections } from '../modules/subscriptions/subscriptions.navigation';
import { TENANCY_SECTIONS } from '../modules/tenancy/tenancy.navigation';
import { EMPLOYEE_SECTIONS, hasEmployeeGrants } from '../modules/employees/domain/employee-navigation';
import { AUTHORIZATION_SECTIONS } from '../modules/authorization/authorization.navigation';
import { INTEGRATION_SECTIONS } from '../modules/integrations/integrations.navigation';
import { OPERATIONS_SECTIONS } from '../modules/platform-operations/platform-operations.navigation';
import { canDocument, sections as documentSections } from '../modules/documents/documents.navigation';
import { canSimulate, simulationSections } from '../modules/simulations/simulations.navigation';
import { ONBOARDING_SECTIONS } from '../modules/onboarding/domain/onboarding.navigation';
import { PAYSLIP_SECTIONS } from '../modules/payslips/domain/payslip-supervision.navigation';
import { companyPayslipSections, hasPayslipGrants } from '../modules/payslips/domain/company-payslips.navigation';
import { REPORT_SECTIONS } from '../modules/reports/domain/platform-reports.navigation';
import { companyReportSections, hasReportGrants } from '../modules/reports/domain/company-reports.navigation';
import { AI_SECTIONS } from '../modules/ai-assistant/domain/ai-assistant.navigation';
import { AUDIT_SECTIONS, canOpenAudit } from '../modules/audit/domain/audit.navigation';
import { SUPPORT_ACCESS, SUPPORT_SECTIONS, supportGrant } from '../modules/support/domain/support.navigation';
import { NOTIFICATIONS_ACCESS, NOTIFICATION_SECTIONS, notificationGrant } from '../modules/notifications/domain/notifications.navigation';
import { canOpenEngineSection, ENGINE_SECTIONS } from '../modules/payroll-engine/domain/engine-access';
import { canOpenPayrollSection, PAYROLL_SECTIONS } from '../modules/payroll/domain/payroll-sections';
import { SECTIONS as SALARY_SECTIONS, can as canViewSalary } from '../modules/salary-structure/domain/salary-sections';

export interface SidebarLink {
  id: string;
  title: string;
  group?: string;
  groupKey?: string;
  requires?: (permissions: string[], platformAdmin: boolean) => boolean;
  fragment?: string;
}

export interface SidebarModule {
  id: string;
  title: string;
  icon: string;
  tenant: boolean;
  platformOnly?: boolean;
  platformPermission?: string;
  visibleTo?: (permissions: readonly string[], platformAdmin: boolean) => boolean;
  links: SidebarLink[];
}

const icons = (path: string) =>
  '<svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">' + path + '</svg>';

export const SIDEBAR_MODULES: SidebarModule[] = [
  {
    id: 'companies', title: $localize`:@@ui-kducvf:Tenancy`, tenant: false, platformOnly: true,
    icon: icons('<path d="M3 21V3h12v18M15 9h6v12M7 7h4M7 11h4M7 15h4M1 21h22"/>'),
    links: TENANCY_SECTIONS.map(({ path, title, group }) => ({ id: path, title, group })),
  },
  {
    id: 'identity', title: $localize`:@@ui-1q31p6j:Identity`, tenant: false, platformOnly: true,
    icon: icons('<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2"/>'),
    links: [{ id: 'users', title: $localize`:@@ui-1x7di3h:User directory` }, { id: 'disabled', title: $localize`:@@ui-i163lk:Administratively disabled` }],
  },
  {
    id: 'authorization', title: $localize`:@@ui-ddeela:Authorization`, tenant: false, platformOnly: true,
    icon: icons('<path d="M12 22s7-3 7-10V5l-7-3-7 3v7c0 7 7 10 7 10Z M9 12l2 2 4-4"/>'),
    links: AUTHORIZATION_SECTIONS.map(({ path, title }) => ({ id: path, title })),
  },
  {
    id: 'integrations', title: $localize`:@@ui-1sd7qpm:Integrations`, tenant: false, platformOnly: true,
    icon: icons('<path d="M9 2v5m6-5v5M6 7h12v4a6 6 0 0 1-12 0V7Zm6 10v5M3 7h18"/>'),
    links: INTEGRATION_SECTIONS.map(({ path, title }) => ({ id: path, title })),
  },
  {
    id: 'platform-operations', title: $localize`:@@ui-1qjs0ns:Platform operations`, tenant: false, platformOnly: true,
    icon: icons('<path d="M3 12h4l3-8 4 16 3-8h4"/>'),
    links: OPERATIONS_SECTIONS.map(({ path, title }) => ({ id: path, title })),
  },
  {
    id: 'contracts', title: $localize`:@@ui-jpjysw:Contracts`, tenant: true,
    icon: icons('<path d="M6 3h9l4 4v14H6zM15 3v5h4M9 12h7M9 16h7"/>'),
    links: [
      ...Object.entries(CONTRACT_VIEWS).map(([view, title]) => ({
        id: view === 'dashboard' ? '' : view, title, requires: (permissions: string[]) => permissions.includes('contracts.read'),
      })),
      { id: 'new', title: $localize`:@@ui-1i4a7n1:New contract`, requires: permissions => ['contracts.read', 'contracts.create'].every(grant => permissions.includes(grant)) },
    ],
  },
  {
    id: 'organization', title: $localize`:@@organization-organization:Organization`, tenant: true,
    icon: icons('<path d="M9 3h6v5H9zM3 16h6v5H3zM15 16h6v5h-6zM12 8v4M6 16v-4h12v4"/>'),
    links: ORGANIZATION_NAVIGATION.flatMap(group => group.items.map(item => ({
      id: item.path === 'overview' ? '' : item.path, title: item.label, group: group.title, groupKey: group.key,
      requires: permissions => permissions.includes('organization:read') && (!item.permission || permissions.includes(item.permission)),
    }))),
  },
  {
    id: 'employees', title: $localize`:@@employees-employees:Employees`, tenant: true,
    icon: icons('<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5v3"/>'),
    links: EMPLOYEE_SECTIONS.map(section => ({
      id: section.path, title: section.title, requires: permissions => hasEmployeeGrants(permissions, section.grants),
    })),
  },
  {
    id: 'leave', title: $localize`:@@ui-1xf0sbk:Leave`, tenant: true,
    icon: icons('<path d="M4 5h16v16H4zM8 3v4M16 3v4M4 10h16m-12 5 2 2 5-5"/>'),
    links: LEAVE_SECTIONS.map(section => ({
      id: section.path === 'overview' ? '' : section.path, title: section.label,
      requires: permissions => section.grants.some(grant => permissions.includes(grant)),
    })),
  },
  {
    id: 'attendance', title: $localize`:@@ui-1eavko2:Attendance`, tenant: true,
    icon: icons('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    links: ATTENDANCE_SECTIONS.map(section => ({
      id: section.path, title: section.title, group: section.group,
      requires: permissions => section.permissions.some(grant => canAttend(permissions, grant)),
    })),
  },
  {
    id: 'loans', title: $localize`:@@ui-jklrbs:Loans`, tenant: true,
    icon: icons('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h1m10 0h1"/>'),
    links: LOAN_SECTIONS.map(section => ({
      id: section.path, title: section.title, group: section.group, requires: permissions => canOpen(section, permissions),
    })),
  },
  {
    id: 'salary-structure', title: $localize`:@@ui-hjlbyy:Salary structure`, tenant: true,
    icon: icons('<path d="M4 20h16M6 20v-6h3v6m2 0V9h3v11m2 0V4h3v16"/>'),
    links: SALARY_SECTIONS.map(section => ({
      id: section.path, title: section.title, group: section.group,
      requires: permissions => section.grants.some(grant => canViewSalary(permissions, grant)),
    })),
  },
  {
    id: 'payroll', title: $localize`:@@ui-ghd2d6:Payroll`, tenant: true,
    icon: icons('<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6m-6 4h6m-6 4h3"/>'),
    links: PAYROLL_SECTIONS.map(section => ({
      id: section.path, title: section.title, group: section.group,
      requires: permissions => canOpenPayrollSection(section, permissions),
    })),
  },
  {
    id: 'payroll-engine', title: $localize`:@@ui-1yye4vg:Payroll engine`, tenant: true,
    icon: icons('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8m-7 5h.01m3 0h.01m3 0h.01m-6 4h.01m3 0h.01m3 0h.01" stroke-linecap="round"/>'),
    links: ENGINE_SECTIONS.map(section => ({
      id: section.id, title: section.title,
      requires: permissions => canOpenEngineSection(section, permissions),
    })),
  },
  {
    id: 'legal-rules', title: $localize`:@@ui-paippd:Legal rules`, tenant: false, platformPermission: LEGAL_READ,
    icon: icons('<path d="M12 3v17M7 21h10M3 7h18M6 7l-3 7h6L6 7Zm12 0-3 7h6l-3-7Z"/>'),
    links: LEGAL_SECTIONS.map(section => ({
      id: section.path, title: section.title, group: section.group,
      requires: permissions => canOpenLegalSection(section, permissions),
    })),
  },
  {
    id: 'company-payments', title: $localize`:@@ui-inyz63:Company payments`, tenant: true,
    icon: icons('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18m-14 5h5"/>'),
    links: companyPaymentSections.map(section => ({ id: section.path, title: section.title, group: section.group,
      requires: grants => companyPaymentAccess(grants, ...section.grants) })),
  },
  {
    id: 'payments', title: $localize`:@@ui-jbt9om:Payments`, tenant: false, visibleTo: canOpenPayments,
    icon: icons('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18m-15 5h4m3 0h2"/>'),
    links: PAYMENT_SECTIONS.map(section => ({
      id: section.path, title: section.title, group: section.group,
      requires: permissions => canOpenPaymentSection(section, permissions),
    })),
  },
  {
    id: 'account', title: $localize`:@@ui-oyp43g:Account`, tenant: false,
    icon: icons('<path d="M12 3 4 6v6c0 4 4 7 8 9 4-2 8-5 8-9V6l-8-3Z"/><path d="m8 12 3 3 5-6"/>'),
    links: [
      { id: 'security', title: $localize`:@@ui-lfgedu:Account security` },
      { id: 'security', fragment: 'password', title: $localize`:@@ui-11q3s6m:Change password` },
      { id: 'security', fragment: 'sessions', title: 'Sessions' },
      { id: 'security', fragment: 'google', title: 'Google account' },
      { id: 'security', fragment: 'permissions', title: $localize`:@@ui-1qtbl5j:Access permissions` },
    ],
  },
  {
    id: 'simulations', title: $localize`:@@ui-1fhsqsf:Simulations`, tenant: true,
    icon: icons('<path d="M4 19h16M5 15l4-5 4 3 6-7M14 6h5v5"/>'),
    links: simulationSections.map(section => ({ id: section.path, title: section.title, group: section.group,
      requires: grants => canSimulate(grants, ...section.grants) })),
  },
  {
    id: 'simulation-oversight', title: 'Simulation oversight', tenant: false, platformOnly: true,
    icon: icons('<path d="M3 12s3-6 9-6 9 6 9 6-3 6-9 6-9-6-9-6Z"/><circle cx="12" cy="12" r="2"/>'),
    links: [{ id: '', title: 'Company simulation indicators' }],
  },
  {
    id: 'documents', title: $localize`:@@ui-oz47lx:Documents`, tenant: true,
    icon: icons('<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>'),
    links: documentSections.map(section => ({ id: section.path, title: section.title, group: section.group,
      requires: grants => canDocument(grants, ...section.permissions) })),
  },
  {
    id: 'document-oversight', title: 'Document oversight', tenant: false, platformOnly: true,
    icon: icons('<path d="M4 20V4m0 16h16M8 16v-4m4 4V7m4 9v-6"/>'),
    links: [{ id: '', title: 'Company document indicators' }],
  },
  {
    id: 'subscriptions', title: $localize`:@@ui-1b78jet:Subscriptions`, tenant: false, platformOnly: true,
    icon: icons('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18m-14 5h5"/>'),
    links: subscriptionSections.map(section => ({ id: section.path, title: section.title, group: section.group })),
  },
  {
    id: 'platform-billing', title: $localize`:@@ui-1g2603t:Platform billing`, tenant: false,
    visibleTo: (grants, platformAdmin) => Boolean(firstBillingSection(grants, platformAdmin)),
    icon: icons('<path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3Zm3 5h8m-8 4h8m-8 4h4"/>'),
    links: BILLING_SECTIONS.map(section => ({
      id: section.path, title: section.title, group: section.group,
      requires: (grants, platformAdmin) => canReadBilling(section, grants, platformAdmin),
    })),
  },
  {
    id: 'onboarding', title: $localize`:@@ui-1vl4baw:Onboarding`, tenant: false, platformOnly: true,
    icon: icons('<path d="M4 21V3h11v6M4 21h16m-9-6h9m-4.5-4.5v9M7 7h4m-4 4h3"/>'),
    links: ONBOARDING_SECTIONS.map(section => ({ id: section.path, title: section.title, group: section.group })),
  },
  {
    id: 'company-payslips', title: 'Company payslips', tenant: true,
    icon: icons('<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6m-6 4h6m-6 4h4"/>'),
    links: companyPayslipSections.map(section => ({ id: section.path, title: section.title, group: section.group,
      requires: grants => hasPayslipGrants(grants, ...section.grants) })),
  },
  {
    id: 'payslips', title: $localize`:@@ui-115ohnw:Payslips`, tenant: false, platformOnly: true,
    icon: icons('<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6m-6 4h6m-6 4h3"/>'),
    links: PAYSLIP_SECTIONS.map(section => ({ id: section.path, title: section.title, group: section.group })),
  },
  {
    id: 'company-reports', title: 'Company reports', tenant: true,
    icon: icons('<path d="M5 20V4h11l3 3v13H5Zm4-5v2m3-5v5m3-8v8"/>'),
    links: companyReportSections.map(section => ({ id: section.path, title: section.title, group: section.group,
      requires: grants => hasReportGrants(grants, ...section.grants) })),
  },
  {
    id: 'reports', title: $localize`:@@ui-wwt148:Reports`, tenant: false, platformOnly: true,
    icon: icons('<path d="M4 3v17h17M8 16v-4m4 4V8m4 8v-6m4 6V5"/>'),
    links: REPORT_SECTIONS.map(section => ({ id: section.path, title: section.title, group: section.group })),
  },
  {
    id: 'ai-assistant', title: $localize`:@@ui-vjpt5r:AI assistant`, tenant: false, platformOnly: true,
    icon: icons('<path d="M12 2v3m0 14v3M2 12h3m14 0h3M6 6l2 2m8 8 2 2M18 6l-2 2M8 16l-2 2"/><circle cx="12" cy="12" r="4"/>'),
    links: AI_SECTIONS.map(section => ({ id: section.path, title: section.title, group: section.group })),
  },
  {
    id: 'audit', title: $localize`:@@ui-17q4nd4:Audit`, tenant: false, visibleTo: canOpenAudit,
    icon: icons('<path d="M12 3 4 6v6c0 4 3 7 8 9 5-2 8-5 8-9V6l-8-3Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>'),
    links: AUDIT_SECTIONS.map(section => ({
      id: section.path, title: section.title, group: section.group, requires: grants => grants.includes(section.permission),
    })),
  },
  {
    id: 'notifications', title: $localize`:@@ui-fki4un:Notifications`, tenant: false,
    icon: icons('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-9 12a3 3 0 0 0 6 0"/>'),
    links: [
      { id: 'inbox', title: 'My notifications', group: 'Notification centre' },
      { id: 'preferences', title: 'My preferences', group: 'Notification centre' },
      ...NOTIFICATION_SECTIONS.map(section => ({
        id: section.path, title: section.title, group: section.group,
        requires: (grants: string[]) => grants.includes(NOTIFICATIONS_ACCESS) && grants.includes(notificationGrant(section.permission)),
      })),
    ],
  },
  {
    id: 'support', title: $localize`:@@ui-txsyvc:Support`, tenant: false, platformPermission: SUPPORT_ACCESS,
    visibleTo: grants => SUPPORT_SECTIONS.some(section => grants.includes(supportGrant(section.permission))),
    icon: icons('<path d="M4 14v-2a8 8 0 1 1 16 0v2M4 12h3v6H4a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2Zm16 0h-3v6h3a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2Zm0 6c0 2-2 3-5 3h-2"/>'),
    links: SUPPORT_SECTIONS.map(section => ({
      id: section.path, title: section.title, group: section.group, requires: grants => grants.includes(supportGrant(section.permission)),
    })),
  },
];
