import { ResourceKind, ImportKind } from './onboarding.models';

type ApplicationFlag = 'nif' | 'duplicates' | 'stalled' | 'company' | 'recoverable' | 'assisted';
export interface OnboardingSection {
  path: string;
  title: string;
  group: string;
  kind: 'overview' | 'applications' | 'resources' | 'events' | 'reports' | 'settings';
  statuses?: string;
  flag?: ApplicationFlag;
  resource?: ResourceKind;
  importKind?: ImportKind;
}

export const ONBOARDING_SECTIONS: OnboardingSection[] = [
  { path: 'overview', title: 'Overview', group: 'Start', kind: 'overview' },
  { path: 'applications', title: 'All applications', group: 'Applications', kind: 'applications' },
  { path: 'in-progress', title: 'In progress', group: 'Applications', kind: 'applications', statuses: 'DRAFT,IN_PROGRESS' },
  { path: 'pending-review', title: 'Pending review', group: 'Applications', kind: 'applications', statuses: 'PENDING_REVIEW' },
  { path: 'information-requested', title: 'Information requested', group: 'Applications', kind: 'applications', statuses: 'ADDITIONAL_INFO' },
  { path: 'completed', title: 'Completed', group: 'Applications', kind: 'applications', statuses: 'COMPLETED' },
  { path: 'closed', title: 'Rejected and cancelled', group: 'Applications', kind: 'applications', statuses: 'REJECTED,CANCELLED' },
  { path: 'stalled', title: 'Inactive applications', group: 'Applications', kind: 'applications', flag: 'stalled' },
  { path: 'company-data', title: 'Company details', group: 'Company verification', kind: 'applications', flag: 'nif' },
  { path: 'documents', title: 'Submitted documents', group: 'Company verification', kind: 'resources', resource: 'DOCUMENT' },
  { path: 'tax-verification', title: 'Tax ID checks', group: 'Company verification', kind: 'applications', flag: 'nif' },
  { path: 'duplicates', title: 'Possible duplicates', group: 'Company verification', kind: 'applications', flag: 'duplicates' },
  { path: 'approvals', title: 'Review queue', group: 'Approvals', kind: 'applications', statuses: 'PENDING_REVIEW' },
  { path: 'approved', title: 'Approved', group: 'Approvals', kind: 'applications', statuses: 'APPROVED,PROVISIONING,FAILED,AWAITING_PAYMENT,COMPLETED' },
  { path: 'rejected', title: 'Rejected', group: 'Approvals', kind: 'applications', statuses: 'REJECTED' },
  { path: 'assisted', title: 'Assisted applications', group: 'Assisted onboarding', kind: 'applications', flag: 'assisted' },
  { path: 'invitations', title: 'Invitations', group: 'Assisted onboarding', kind: 'resources', resource: 'INVITATION' },
  { path: 'environments', title: 'Company environments', group: 'Provisioning', kind: 'applications', flag: 'company' },
  { path: 'provisioning', title: 'Running tasks', group: 'Provisioning', kind: 'applications', statuses: 'PROVISIONING' },
  { path: 'awaiting-payment', title: 'Awaiting payment', group: 'Provisioning', kind: 'applications', statuses: 'AWAITING_PAYMENT' },
  { path: 'failures', title: 'Failed tasks', group: 'Provisioning', kind: 'applications', statuses: 'FAILED' },
  { path: 'recovery', title: 'Task recovery', group: 'Provisioning', kind: 'applications', flag: 'recoverable' },
  { path: 'imports', title: 'Import batches', group: 'Imports', kind: 'resources', resource: 'IMPORT' },
  { path: 'employee-imports', title: 'Employee imports', group: 'Imports', kind: 'resources', resource: 'IMPORT', importKind: 'EMPLOYEES' },
  { path: 'contract-imports', title: 'Contract imports', group: 'Imports', kind: 'resources', resource: 'IMPORT', importKind: 'CONTRACTS' },
  { path: 'salary-imports', title: 'Salary imports', group: 'Imports', kind: 'resources', resource: 'IMPORT', importKind: 'SALARIES' },
  { path: 'import-errors', title: 'Import errors', group: 'Imports', kind: 'resources', resource: 'IMPORT', statuses: 'PARTIALLY_COMPLETED' },
  { path: 'communications', title: 'Communications', group: 'Oversight', kind: 'events' },
  { path: 'reports', title: 'Reports', group: 'Oversight', kind: 'reports' },
  { path: 'audit', title: 'Audit history', group: 'Oversight', kind: 'events' },
  { path: 'settings', title: 'Settings', group: 'Oversight', kind: 'settings' },
];
