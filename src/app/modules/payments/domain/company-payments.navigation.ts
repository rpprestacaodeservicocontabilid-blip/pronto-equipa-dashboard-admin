export type CompanyPaymentView = 'overview' | 'instructions' | 'batches' | 'orders' | 'transactions'
  | 'returns' | 'bank-accounts' | 'reconciliations' | 'statements' | 'integrations' | 'policies' | 'reports';
export interface CompanyPaymentSection {
  path: string; title: string; group: string; view: CompanyPaymentView; grants: string[]; status?: string;
}
const read = 'payments:read';
export const companyPaymentSections: CompanyPaymentSection[] = [
  { path: 'overview', title: 'Company indicators', group: 'Operations', view: 'overview', grants: ['payments:reports:read'] },
  { path: 'instructions', title: 'Payroll instructions', group: 'Operations', view: 'instructions', grants: [read] },
  { path: 'batches', title: 'Payment batches', group: 'Operations', view: 'batches', grants: [read] },
  { path: 'approvals', title: 'Financial approvals', group: 'Operations', view: 'batches', status: 'SUBMITTED', grants: [read] },
  { path: 'execution', title: 'Approved batches', group: 'Operations', view: 'batches', status: 'APPROVED', grants: [read] },
  { path: 'orders', title: 'Payment orders', group: 'Transfers', view: 'orders', grants: ['payments:orders:read'] },
  { path: 'unconfirmed', title: 'Unconfirmed submissions', group: 'Transfers', view: 'orders', status: 'SUBMISSION_UNKNOWN', grants: ['payments:orders:read'] },
  { path: 'failed', title: 'Failed transfers', group: 'Transfers', view: 'orders', status: 'FAILED', grants: ['payments:orders:read'] },
  { path: 'transactions', title: 'Transactions', group: 'Transfers', view: 'transactions', grants: ['payments:transactions:read'] },
  { path: 'returns', title: 'Returned payments', group: 'Transfers', view: 'returns', grants: ['payments:transactions:read'] },
  { path: 'bank-accounts', title: 'Company bank accounts', group: 'Banking', view: 'bank-accounts', grants: ['payments:bank-accounts:read'] },
  { path: 'integrations', title: 'Payment providers', group: 'Banking', view: 'integrations', grants: ['payments:providers:read'] },
  { path: 'statements', title: 'Import bank statement', group: 'Banking', view: 'statements', grants: ['payments:reconciliation:execute', 'payments:bank-accounts:read'] },
  { path: 'reconciliation', title: 'Reconciliation and exceptions', group: 'Banking', view: 'reconciliations', grants: ['payments:reconciliation:read'] },
  { path: 'policies', title: 'Approval policy', group: 'Governance', view: 'policies', grants: ['payments:policies:read'] },
  { path: 'reports', title: 'Payment reports', group: 'Governance', view: 'reports', grants: ['payments:reports:read'] },
];
export function companyPaymentAccess(grants: readonly string[], ...required: string[]) {
  return required.every(grant => grants.includes(grant));
}
