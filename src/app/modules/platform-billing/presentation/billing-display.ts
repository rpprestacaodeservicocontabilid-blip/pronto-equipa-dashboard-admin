import { money } from '../../../shared/utils/format-money';
import { BillingKind, BillingRecord } from '../domain/billing.models';

export type Column = readonly [string, string];
const reference: Column = ['number', 'Reference'];
const company: Column = ['companyName', 'Company'];
const state: Column = ['status', 'Status'];
const created: Column = ['createdAt', 'Registered'];
const value: Column = ['amount', 'Amount'];
export const ageingLabels = ['Current', '1–30 days', '31–60 days', '61–90 days', 'Over 90 days'];
export const columns: Record<BillingKind, Column[]> = {
  INVOICE: [reference, company, ['issuedAt', 'Issued'], ['dueAt', 'Due date'], ['total', 'Total'], ['outstanding', 'Outstanding'], state],
  PAYMENT: [['reference', 'Reference'], company, ['provider', 'Provider'], value, ['updatedAt', 'Last update'], state],
  PAYMENT_ALLOCATION: [['paymentId', 'Receipt'], ['invoiceId', 'Invoice'], company, value, ['actor', 'Applied by'], created, state],
  RECEIPT: [reference, company, ['issuedAt', 'Issued'], value, state],
  CREDIT_NOTE: [reference, company, ['originalNumber', 'Original invoice'], value, ['issuedAt', 'Issued'], state],
  REFUND: [['id', 'Reference'], company, value, ['reason', 'Reason'], created, state],
  SCHEDULE: [['key', 'Schedule'], company, ['nextAt', 'Next invoice'], ['intervalMonths', 'Interval (months)'], ['currency', 'Currency'], state],
  OUTBOX: [['event', 'Event'], company, ['attempts', 'Attempts'], created, state],
  ACCOUNT: [['name', 'Billing name'], company, ['taxId', 'Tax ID'], ['email', 'Billing email'], state],
  ACCOUNT_HISTORY: [['name', 'Billing name'], company, ['taxId', 'Tax ID'], ['email', 'Billing email'], created],
  STATEMENT: [['key', 'Import reference'], company, ['count', 'Entries'], ['importedBy', 'Imported by'], created, state],
  BANK_ENTRY: [['reference', 'Bank reference'], company, ['occurredAt', 'Movement date'], value, state],
  RECONCILIATION: [['entryId', 'Bank entry'], company, ['paymentId', 'Payment'], ['actor', 'Reconciled by'], created, state],
  TAX_RULE: [['version', 'Version'], company, ['basisPoints', 'Rate'], ['validFrom', 'Effective from'], ['validUntil', 'Effective until'], state],
  SERIES: [['prefix', 'Series'], company, ['documentType', 'Document type'], ['counter', 'Last number'], ['validationReference', 'Validation reference'], state],
  AUDIT: [['event', 'Operation'], company, ['actor', 'Actor'], ['target', 'Record reference'], created, state],
};

export const statuses: Partial<Record<BillingKind, string[]>> = {
  INVOICE: ['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID'],
  PAYMENT: ['PENDING', 'CONFIRMED', 'FAILED'],
  REFUND: ['REQUESTED', 'APPROVED', 'COMPLETED', 'REJECTED'],
  SCHEDULE: ['ACTIVE', 'CANCELLED'],
  OUTBOX: ['PENDING', 'RETRY', 'DEAD', 'PROCESSED_INTERNAL', 'PUBLISHED'],
  BANK_ENTRY: ['UNMATCHED', 'DISPUTED', 'MATCHED'],
  RECONCILIATION: ['MATCHED', 'REVERSED'],
};

export const detailColumns: Partial<Record<BillingKind, Column[]>> = {
  INVOICE: [['id', 'Record ID'], ['paid', 'Paid'], ['credited', 'Credit applied'], ['tax', 'Tax'],
    ['subscriptionId', 'Subscription'], ['originalInvoiceId', 'Original invoice'], ['reason', 'Reason']],
  PAYMENT: [['id', 'Record ID'], ['invoiceId', 'Initial invoice'], ['allocated', 'Applied'], ['availableToAllocate', 'Available to apply'],
    ['requestedBy', 'Recorded by'], ['confirmedBy', 'Confirmed by'], ['confirmedAt', 'Confirmed'], ['evidence', 'Evidence']],
  RECEIPT: [['invoiceId', 'Invoice'], ['paymentId', 'Payment']],
  CREDIT_NOTE: [['invoiceId', 'Invoice'], ['reason', 'Reason']],
  REFUND: [['paymentId', 'Payment'], ['requestedBy', 'Requested by'], ['approvedBy', 'Reviewed by'], ['executedBy', 'Completed by'],
    ['completedAt', 'Completed'], ['evidence', 'Evidence']],
  ACCOUNT: [['address', 'Billing address'], ['updatedAt', 'Last change']],
  ACCOUNT_HISTORY: [['address', 'Billing address']],
  BANK_ENTRY: [['paymentId', 'Payment'], ['reconciliationId', 'Reconciliation'], ['reviewReason', 'Discrepancy'], ['reviewedBy', 'Reviewed by'], ['reviewedAt', 'Reviewed']],
  RECONCILIATION: [['id', 'Record ID'], ['amount', 'Matched amount'], ['reversalReason', 'Reversal reason'], ['reversedBy', 'Reversed by'], ['reversedAt', 'Reversed']],
  AUDIT: [['reason', 'Reason']],
  TAX_RULE: [['legalReference', 'Fiscal reference']],
  OUTBOX: [['invoiceId', 'Invoice'], ['paymentId', 'Payment']],
  SCHEDULE: [['subscriptionId', 'Subscription'], ['dueDays', 'Payment term (days)'], ['automatic', 'Automatic']],
};

export const statusLabel = (value: string) => value.toLowerCase().replaceAll('_', ' ').replace(/^./, char => char.toUpperCase());
export function statusTone(status: string) {
  if (['PAID', 'CONFIRMED', 'COMPLETED', 'MATCHED', 'ACTIVE', 'PROCESSED_INTERNAL', 'PUBLISHED'].includes(status)) {
    return 'bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400';
  }
  if (['FAILED', 'DEAD', 'REJECTED', 'OVERDUE'].includes(status)) return 'bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-400';
  if (['PENDING', 'REQUESTED', 'PARTIALLY_PAID', 'UNMATCHED', 'DISPUTED', 'RETRY'].includes(status)) return 'bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400';
  return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
}

function minor(value: unknown) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value ?? '0'));
  return match ? BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0')) : 0n;
}
export function openBalance(record: BillingRecord) {
  const balance = minor(record.data['total']) - minor(record.data['credited']) - minor(record.data['paid']);
  const result = balance > 0n ? balance : 0n;
  return `${result / 100n}.${String(result % 100n).padStart(2, '0')}`;
}
const date = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Luanda', dateStyle: 'medium' });
export function cell(record: BillingRecord, key: string): string {
  const value = Object.hasOwn(record, key) ? record[key as keyof BillingRecord] : record.data[key];
  if (key === 'number') return String(value || record.key);
  if (key === 'target') return String(record.data['invoiceId'] || record.data['paymentId'] || record.data['entryId'] || record.data['id'] || '—');
  if (key === 'outstanding') return record.status === 'DRAFT' ? '—' : money(openBalance(record), String(record.data['currency']));
  if (value == null || value === '') return '—';
  if (key === 'status') return statusLabel(String(value));
  if (['amount', 'total', 'paid', 'credited', 'tax', 'allocated', 'availableToAllocate'].includes(key)) return money(String(value), String(record.data['currency'] ?? ''));
  if (key === 'basisPoints') return (Number(value) / 100).toFixed(2) + '%';
  if (key.endsWith('At') || key.startsWith('valid')) {
    const day = new Date(String(value));
    return Number.isFinite(day.getTime()) ? date.format(day) : '—';
  }
  return typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value);
}
