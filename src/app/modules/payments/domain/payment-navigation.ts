import { Incident, PaymentView } from './payment.models';

export const PAYMENT_PERMISSIONS = {
  operations: 'payments.platform.read',
  integrations: 'payments.platform.integrations.read',
  reports: 'payments.platform.reports.read',
  audit: 'payments.platform.audit.read',
  policies: 'payments.platform.policies.read',
} as const;

type PermissionGroup = keyof typeof PAYMENT_PERMISSIONS;

export interface PaymentSection {
  path: string;
  view: PaymentView;
  title: string;
  group: string;
  grant?: PermissionGroup;
  incident?: Incident;
  description: string;
}

export const PAYMENT_SECTIONS: readonly PaymentSection[] = [
  { path: 'overview', view: 'overview', title: 'Overview', group: 'Supervision', grant: 'operations',
    description: 'Follow payroll payments from instruction through bank settlement and reconciliation.' },
  { path: 'company-payments', view: 'instructions', title: 'Company payments', group: 'Supervision', grant: 'operations',
    description: 'Find salary payment instructions, their payroll references and recorded history.' },
  { path: 'orders', view: 'orders', title: 'Payment orders', group: 'Supervision', grant: 'operations',
    description: 'Inspect orders sent to payment providers and the outcomes of individual attempts.' },
  { path: 'batches', view: 'batches', title: 'Payment batches', group: 'Supervision', grant: 'operations',
    description: 'Track batch approval, processing and progress by transfer status.' },
  { path: 'transactions', view: 'transactions', title: 'Bank transactions', group: 'Supervision', grant: 'operations',
    description: 'Review transaction amounts, masked bank references and settlement dates.' },
  { path: 'pending', view: 'orders', title: 'Pending payments', group: 'Monitoring', grant: 'operations', incident: 'pending',
    description: 'Investigate orders awaiting completion, including submissions with an unknown outcome.' },
  { path: 'failed', view: 'orders', title: 'Failed payments', group: 'Monitoring', grant: 'operations', incident: 'failed',
    description: 'Inspect failed and rejected orders and their recorded attempt codes.' },
  { path: 'returns', view: 'returns', title: 'Returns', group: 'Monitoring', grant: 'operations',
    description: 'Track returned amounts and find the associated bank transactions.' },
  { path: 'reconciliation', view: 'reconciliations', title: 'Reconciliation', group: 'Monitoring', grant: 'operations',
    description: 'Monitor unmatched, disputed and resolved bank movements across companies.' },
  { path: 'providers', view: 'providers', title: 'Banks and providers', group: 'Banking', grant: 'integrations',
    description: 'Review installed payment adapters and their supported capabilities.' },
  { path: 'integrations', view: 'integrations', title: 'Bank integrations', group: 'Banking', grant: 'integrations',
    description: 'Review company configurations and their activation status.' },
  { path: 'bank-files', view: 'files', title: 'Bank files', group: 'Banking', grant: 'integrations',
    description: 'Monitor statement imports and their processing results.' },
  { path: 'policies', view: 'policies', title: 'Policies and approvals', group: 'Governance', grant: 'policies',
    description: 'Inspect recorded company approval requirements and thresholds.' },
  { path: 'audit', view: 'audit', title: 'Financial audit', group: 'Governance', grant: 'audit',
    description: 'Review recorded payment events by company, actor and operation.' },
  { path: 'reports', view: 'reports', title: 'Reports', group: 'Governance', grant: 'reports',
    description: 'Compare recorded volume by status, company or provider, grouped by currency.' },
  { path: 'settings', view: 'settings', title: 'Settings', group: 'Governance',
    description: 'Review the platform payment permissions granted to your session.' },
];

export function canOpenPayments(permissions: readonly string[]): boolean {
  return Object.values(PAYMENT_PERMISSIONS).some(grant => permissions.includes(grant));
}

export function canOpenPaymentSection(section: PaymentSection, permissions: readonly string[]): boolean {
  return section.grant ? permissions.includes(PAYMENT_PERMISSIONS[section.grant]) : canOpenPayments(permissions);
}
