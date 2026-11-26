import { ExecutionScope, PayrollRun, RunStatus, RunType } from './payroll.models';

export const PAYROLL_READ = 'payroll:read';
export const SENSITIVE_RESULTS = 'payroll:results:read-sensitive';
export const REPORTS_READ = 'payroll:reports:read';
export const POLICIES_MANAGE = 'payroll:policies:manage';
export const HISTORY_READ = 'payroll:history:read';
export const PAYMENTS_READ = 'payroll:payments:read';
export const PAYMENTS_PREPARE = 'payroll:payments:prepare';
export const CORRECTIONS_CREATE = 'payroll:corrections:create';
export const RUNS_CREATE = 'payroll:runs:create';

export type PayrollTab = 'summary' | 'issues' | 'results' | 'approvals' | 'closing' | 'payments' | 'history';

export interface PayrollSection {
  path: string;
  title: string;
  group: string;
  view: 'overview' | 'periods' | 'runs' | 'reports' | 'settings';
  grants?: string[];
  types?: RunType[];
  scope?: ExecutionScope;
  statuses?: RunStatus[];
  create?: RunType[];
  tab?: PayrollTab;
}

const withResults: RunStatus[] = ['PROCESSING', 'PARTIALLY_PROCESSED', 'FAILED', 'READY_FOR_REVIEW', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CLOSED'];
export const PAYROLL_SECTIONS: PayrollSection[] = [
  { path: 'overview', title: $localize`:@@ui-thnxru:Overview`, group: 'Planning', view: 'overview' },
  { path: 'periods', title: 'Payroll periods', group: 'Planning', view: 'periods' },
  { path: 'pre-processing', title: 'Pre-processing', group: 'Planning', view: 'runs',
    statuses: ['DRAFT', 'VALIDATING', 'VALIDATION_FAILED'] },
  { path: 'monthly', title: 'Monthly processing', group: 'Processing', view: 'runs',
    types: ['REGULAR'], scope: 'COLLECTIVE', create: ['REGULAR'] },
  { path: 'individual', title: 'Individual processing', group: 'Processing', view: 'runs',
    scope: 'INDIVIDUAL', create: ['REGULAR', 'OFF_CYCLE', 'TERMINATION', 'SIMULATION'] },
  { path: 'batches', title: 'Batch processing', group: 'Processing', view: 'runs',
    scope: 'COLLECTIVE', create: ['REGULAR', 'OFF_CYCLE', 'TERMINATION', 'SIMULATION'] },
  { path: 'off-cycle', title: 'Off-cycle processing', group: 'Processing', view: 'runs',
    types: ['OFF_CYCLE'], create: ['OFF_CYCLE'] },
  { path: 'supplements', title: 'Supplementary runs', group: 'Adjustments', view: 'runs',
    types: ['SUPPLEMENTARY'], create: ['SUPPLEMENTARY'] },
  { path: 'retroactive', title: 'Retroactive runs', group: 'Adjustments', view: 'runs',
    types: ['RETROACTIVE'], create: ['RETROACTIVE'] },
  { path: 'corrections', title: 'Corrections', group: 'Adjustments', view: 'runs',
    types: ['CORRECTION'], create: ['CORRECTION'] },
  { path: 'worksheets', title: 'Payroll worksheets', group: 'Review', view: 'runs',
    statuses: withResults, grants: [SENSITIVE_RESULTS], tab: 'results' },
  { path: 'issues', title: 'Issues and exceptions', group: 'Review', view: 'runs',
    statuses: ['VALIDATION_FAILED', 'PARTIALLY_PROCESSED', 'FAILED'], tab: 'issues' },
  { path: 'approvals', title: $localize`:@@ui-1m405m7:Approvals`, group: 'Review', view: 'runs',
    statuses: ['READY_FOR_REVIEW', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CLOSED'], tab: 'approvals' },
  { path: 'closing', title: 'Payroll closing', group: 'Review', view: 'runs',
    statuses: ['APPROVED', 'CLOSED'], tab: 'closing' },
  { path: 'payments', title: 'Payment preparation', group: 'Review', view: 'runs',
    statuses: ['CLOSED'], grants: [PAYMENTS_READ, PAYMENTS_PREPARE], tab: 'payments' },
  { path: 'history', title: 'Payroll history', group: 'Oversight', view: 'runs', grants: [HISTORY_READ], tab: 'history' },
  { path: 'reports', title: $localize`:@@ui-wwt148:Reports`, group: 'Oversight', view: 'reports', grants: [REPORTS_READ] },
  { path: 'settings', title: $localize`:@@ui-ktdb8o:Settings`, group: 'Oversight', view: 'settings', grants: [POLICIES_MANAGE] },
];

export function canOpenPayrollSection(section: PayrollSection, permissions: string[]) {
  if (section.view !== 'settings' && !permissions.includes(PAYROLL_READ)) return false;
  return !section.grants || section.grants.some(grant => permissions.includes(grant));
}

export function matchesPayrollSection(section: PayrollSection, run: PayrollRun) {
  return (!section.types || section.types.includes(run.runType)) &&
    (!section.scope || section.scope === run.executionScope) &&
    (!section.statuses || section.statuses.includes(run.status));
}

export function canCreatePayrollRun(type: RunType, grants: string[]) {
  return grants.includes(type === 'CORRECTION' || type === 'SUPPLEMENTARY' ? CORRECTIONS_CREATE : RUNS_CREATE);
}
