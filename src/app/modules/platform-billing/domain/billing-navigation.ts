import { BillingFilters, BillingKind } from './billing.models';

export interface BillingSection {
  path: string;
  title: string;
  group: string;
  kind?: BillingKind;
  preset?: BillingFilters;
}

export const BILLING_SECTIONS: readonly BillingSection[] = [
  { path: 'overview', title: 'Financial overview', group: '' },
  { path: 'accounts', title: 'Customers and balances', group: 'Customers and billing' },
  { path: 'invoices', title: $localize`:@@ui-7b7gu1:Invoices`, group: 'Customers and billing', kind: 'INVOICE' },
  { path: 'drafts', title: 'Invoice drafts', group: 'Customers and billing', kind: 'INVOICE', preset: { status: 'DRAFT' } },
  { path: 'schedules', title: 'Billing schedules', group: 'Customers and billing', kind: 'SCHEDULE' },
  { path: 'cycles', title: 'Recurring invoices', group: 'Customers and billing', kind: 'INVOICE', preset: { recurring: true } },
  { path: 'events', title: 'Processing events', group: 'Customers and billing', kind: 'OUTBOX' },
  { path: 'failed-events', title: 'Failed processing events', group: 'Customers and billing', kind: 'OUTBOX', preset: { status: 'DEAD' } },
  { path: 'receipts', title: 'Receipts and documents', group: 'Customers and billing', kind: 'RECEIPT' },
  { path: 'payments', title: 'Payments received', group: 'Collections and receipts', kind: 'PAYMENT' },
  { path: 'pending-payments', title: 'Pending confirmation', group: 'Collections and receipts', kind: 'PAYMENT', preset: { status: 'PENDING' } },
  { path: 'unallocated-payments', title: 'Unallocated receipts', group: 'Collections and receipts', kind: 'PAYMENT', preset: { unallocated: true } },
  { path: 'allocations', title: 'Payment allocations', group: 'Collections and receipts', kind: 'PAYMENT_ALLOCATION' },
  { path: 'collections', title: 'Overdue invoices', group: 'Collections and receipts', kind: 'INVOICE', preset: { overdue: true } },
  { path: 'ageing', title: 'Receivables ageing', group: 'Collections and receipts' },
  { path: 'refunds', title: 'Refunds', group: 'Collections and receipts', kind: 'REFUND' },
  { path: 'credit-notes', title: 'Credit notes', group: 'Financial control', kind: 'CREDIT_NOTE' },
  { path: 'debit-notes', title: 'Debit notes', group: 'Financial control', kind: 'INVOICE', preset: { debit: true } },
  { path: 'statements', title: 'Bank statements', group: 'Financial control', kind: 'STATEMENT' },
  { path: 'bank-entries', title: 'Bank entries', group: 'Financial control', kind: 'BANK_ENTRY' },
  { path: 'unmatched-entries', title: 'Unmatched bank entries', group: 'Financial control', kind: 'BANK_ENTRY', preset: { status: 'UNMATCHED' } },
  { path: 'disputed-entries', title: 'Bank discrepancies', group: 'Financial control', kind: 'BANK_ENTRY', preset: { status: 'DISPUTED' } },
  { path: 'reconciliation', title: 'Reconciliation', group: 'Financial control', kind: 'RECONCILIATION' },
  { path: 'reversed-reconciliations', title: 'Reversed reconciliations', group: 'Financial control', kind: 'RECONCILIATION', preset: { status: 'REVERSED' } },
  { path: 'providers', title: 'Banks and providers', group: 'Configuration and reporting' },
  { path: 'tax-rules', title: 'Taxes and rates', group: 'Configuration and reporting', kind: 'TAX_RULE' },
  { path: 'series', title: 'Document series', group: 'Configuration and reporting', kind: 'SERIES' },
  { path: 'billing-accounts', title: 'Billing details', group: 'Configuration and reporting', kind: 'ACCOUNT' },
  { path: 'account-history', title: 'Billing account history', group: 'Configuration and reporting', kind: 'ACCOUNT_HISTORY' },
  { path: 'reports', title: 'Financial reports', group: 'Configuration and reporting' },
  { path: 'audit', title: 'Financial audit', group: 'Configuration and reporting', kind: 'AUDIT' },
];

const recordGrant: Record<BillingKind, string> = {
  ACCOUNT: 'accounts:read', ACCOUNT_HISTORY: 'accounts:read', INVOICE: 'invoices:read',
  PAYMENT: 'payments:read', PAYMENT_ALLOCATION: 'payments:read', RECEIPT: 'receipts:read',
  CREDIT_NOTE: 'credit-notes:read', REFUND: 'refunds:read', SCHEDULE: 'schedules:read',
  OUTBOX: 'schedules:read', STATEMENT: 'reconciliation:read', BANK_ENTRY: 'reconciliation:read',
  RECONCILIATION: 'reconciliation:read', TAX_RULE: 'tax-rules:read', SERIES: 'document-series:read', AUDIT: 'audit:read',
};

export const canUseBilling = (permission: string, grants: readonly string[], platformAdmin: boolean) =>
  platformAdmin || grants.includes('platform-billing:' + permission);

export function canReadBilling(section: BillingSection, grants: readonly string[], platformAdmin: boolean) {
  const permission = section.preset?.overdue ? 'collections:read' :
    section.kind ? recordGrant[section.kind] : section.path === 'accounts' ? 'accounts:read' : 'reports:read';
  return canUseBilling(permission, grants, platformAdmin);
}

export const firstBillingSection = (grants: readonly string[], platformAdmin: boolean) =>
  BILLING_SECTIONS.find(section => canReadBilling(section, grants, platformAdmin));
