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
  { path: 'invoices', title: 'Invoices', group: 'Customers and billing', kind: 'INVOICE' },
  { path: 'schedules', title: 'Billing schedules', group: 'Customers and billing', kind: 'SCHEDULE' },
  { path: 'cycles', title: 'Recurring invoices', group: 'Customers and billing', kind: 'INVOICE', preset: { recurring: true } },
  { path: 'events', title: 'Processing events', group: 'Customers and billing', kind: 'OUTBOX' },
  { path: 'receipts', title: 'Receipts and documents', group: 'Customers and billing', kind: 'RECEIPT' },
  { path: 'payments', title: 'Payments received', group: 'Collections and receipts', kind: 'PAYMENT' },
  { path: 'collections', title: 'Overdue invoices', group: 'Collections and receipts', kind: 'INVOICE', preset: { overdue: true } },
  { path: 'ageing', title: 'Receivables ageing', group: 'Collections and receipts' },
  { path: 'refunds', title: 'Refunds', group: 'Collections and receipts', kind: 'REFUND' },
  { path: 'credit-notes', title: 'Credit notes', group: 'Financial control', kind: 'CREDIT_NOTE' },
  { path: 'debit-notes', title: 'Debit notes', group: 'Financial control', kind: 'INVOICE', preset: { debit: true } },
  { path: 'statements', title: 'Bank statements', group: 'Financial control', kind: 'STATEMENT' },
  { path: 'bank-entries', title: 'Bank entries', group: 'Financial control', kind: 'BANK_ENTRY' },
  { path: 'reconciliation', title: 'Reconciliation', group: 'Financial control', kind: 'RECONCILIATION' },
  { path: 'providers', title: 'Banks and providers', group: 'Configuration and reporting' },
  { path: 'tax-rules', title: 'Taxes and rates', group: 'Configuration and reporting', kind: 'TAX_RULE' },
  { path: 'series', title: 'Document series', group: 'Configuration and reporting', kind: 'SERIES' },
  { path: 'billing-accounts', title: 'Billing details', group: 'Configuration and reporting', kind: 'ACCOUNT' },
  { path: 'account-history', title: 'Billing account history', group: 'Configuration and reporting', kind: 'ACCOUNT_HISTORY' },
  { path: 'reports', title: 'Financial reports', group: 'Configuration and reporting' },
  { path: 'audit', title: 'Financial audit', group: 'Configuration and reporting', kind: 'AUDIT' },
];
