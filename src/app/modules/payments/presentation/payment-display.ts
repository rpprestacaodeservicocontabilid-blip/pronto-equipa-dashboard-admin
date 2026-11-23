import { PaymentDirectory } from '../domain/payment.models';

export interface Column {
  key: string;
  label: string;
}

const field = (key: string, label: string): Column => ({ key, label });
const identifier = field('id', 'Reference');
const company = field('companyId', 'Company');
const amount = field('amount', 'Amount');
const status = field('status', 'Status');
const created = field('createdAt', 'Registered');
const provider = field('providerId', 'Provider');

export const columns: Record<PaymentDirectory, Column[]> = {
  instructions: [identifier, company, field('payrollResultId', 'Payroll result'), amount, status, created],
  orders: [identifier, company, provider, amount, status, field('submittedAt', 'Submitted'), created],
  batches: [field('code', 'Batch'), company, field('totalAmount', 'Total'), status, field('approvedAt', 'Approved'), created],
  transactions: [identifier, company, field('providerReference', 'Bank reference'), amount, status, field('settledAt', 'Settled')],
  returns: [identifier, company, field('transactionId', 'Transaction'), amount, field('returnedAt', 'Returned')],
  reconciliations: [identifier, company, field('transactionId', 'Transaction'), field('externalAmount', 'Bank amount'), status, created],
  integrations: [provider, company, field('providerType', 'Type'), status, created],
  files: [identifier, company, status, field('rowCount', 'Rows'), field('importedBy', 'Imported by'), created],
  policies: [company, field('baseApprovals', 'Approvers'), field('highValueThreshold', 'High-value threshold'),
    field('highValueApprovals', 'High-value approvers'), field('active', 'Active')],
  audit: [field('action', 'Operation'), company, field('actorUserId', 'Actor'), field('entityType', 'Resource'),
    field('entityId', 'Resource reference'), created],
};

export const relatedColumns: Partial<Record<PaymentDirectory, Column[]>> = {
  instructions: [field('paymentType', 'Payment type'), field('method', 'Method')],
  orders: [field('instructionId', 'Instruction'), field('batchId', 'Batch')],
  transactions: [field('orderId', 'Order'), created],
  reconciliations: [field('resolvedAt', 'Resolved')],
};

export const eventColumns = [field('action', 'Operation'), field('actorUserId', 'Actor'), created];
export const attemptColumns = [
  field('attemptNumber', 'Attempt'), status, field('providerReference', 'Bank reference'),
  field('responseCode', 'Response code'), field('errorCode', 'Error code'),
  field('startedAt', 'Started'), field('completedAt', 'Completed'),
];
export const integrationHistoryColumns = [
  field('orderId', 'Order'), ...attemptColumns.filter(column => column.key !== 'providerReference'),
];

const paymentStates = [
  'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SUBMITTED', 'PROCESSING', 'SUBMISSION_UNKNOWN',
  'SETTLED', 'PARTIALLY_SETTLED', 'RECONCILED', 'REJECTED', 'FAILED', 'RETURNED',
  'CANCELLED', 'RECONCILIATION_EXCEPTION',
];
export const filtersByView: Partial<Record<PaymentDirectory, string[]>> = {
  instructions: paymentStates,
  orders: paymentStates,
  batches: ['DRAFT', 'VALIDATED', 'SUBMITTED', 'APPROVED', 'PROCESSING', 'SETTLED', 'PARTIALLY_SETTLED', 'SUBMISSION_UNKNOWN', 'REJECTED', 'FAILED'],
  transactions: paymentStates,
  reconciliations: ['PENDING', 'MATCHED', 'RECONCILIATION_EXCEPTION', 'RESOLVED'],
  integrations: ['ACTIVE', 'INACTIVE', 'PENDING'],
  files: ['IMPORTED', 'RECONCILED'],
};
export const incidentStates = {
  pending: ['PENDING_APPROVAL', 'APPROVED', 'SUBMITTED', 'PROCESSING', 'SUBMISSION_UNKNOWN', 'PARTIALLY_SETTLED'],
  failed: ['FAILED', 'REJECTED'],
};

export const label = (value: string) => value === 'SUBMISSION_UNKNOWN' ? 'Submission unknown'
  : value.toLowerCase().replaceAll('_', ' ').replace(/^./, letter => letter.toUpperCase());

export function statusTone(value: string) {
  if (['SETTLED', 'RECONCILED', 'MATCHED', 'RESOLVED', 'ACTIVE', 'IMPORTED'].includes(value)) {
    return 'bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400';
  }
  if (['FAILED', 'REJECTED', 'RETURNED', 'RECONCILIATION_EXCEPTION'].includes(value)) {
    return 'bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-400';
  }
  if (['PENDING', ...incidentStates.pending].includes(value)) {
    return 'bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400';
  }
  return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
}

export { money } from '../../../shared/utils/format-money';
