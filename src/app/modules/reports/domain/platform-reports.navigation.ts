import { ReportCode } from './platform-reports.models';

export interface ReportSection {
  path: string; title: string; group: string;
  view: 'overview' | 'catalog' | 'analysis' | 'executions' | 'exports' | 'templates' | 'schedules' | 'audit' | 'policy';
  code?: ReportCode;
}

export const REPORT_SECTIONS: ReportSection[] = [
  { path: 'overview', title: $localize`:@@ui-thnxru:Overview`, group: 'Reporting', view: 'overview' },
  { path: 'catalog', title: 'Report catalogue', group: 'Reporting', view: 'catalog' },
  { path: 'analysis', title: 'Analysis and trends', group: 'Reporting', view: 'analysis' },
  { path: 'activity', title: 'Report activity', group: 'Operational reports', view: 'analysis', code: 'REPORT_ACTIVITY' },
  { path: 'domain-usage', title: 'Usage by domain', group: 'Operational reports', view: 'analysis', code: 'DOMAIN_USAGE' },
  { path: 'payroll', title: 'Payroll operations', group: 'Operational reports', view: 'analysis', code: 'PAYROLL_ACTIVITY' },
  { path: 'payments', title: 'Payment operations', group: 'Operational reports', view: 'analysis', code: 'PAYMENT_ACTIVITY' },
  { path: 'simulations', title: 'Simulation operations', group: 'Operational reports', view: 'analysis', code: 'SIMULATION_ACTIVITY' },
  { path: 'payslips', title: 'Payslip operations', group: 'Operational reports', view: 'analysis', code: 'PAYSLIP_ACTIVITY' },
  { path: 'onboarding', title: 'Company onboarding', group: 'Operational reports', view: 'analysis', code: 'ONBOARDING_ACTIVITY' },
  { path: 'executions', title: 'Execution history', group: 'Workspace', view: 'executions' },
  { path: 'templates', title: 'Saved templates', group: 'Workspace', view: 'templates' },
  { path: 'schedules', title: 'Scheduled reports', group: 'Workspace', view: 'schedules' },
  { path: 'exports', title: $localize`:@@ui-w9ox5s:Exports`, group: 'Workspace', view: 'exports' },
  { path: 'audit', title: 'Audit trail', group: 'Governance', view: 'audit' },
  { path: 'settings', title: 'Report policies', group: 'Governance', view: 'policy' },
];
