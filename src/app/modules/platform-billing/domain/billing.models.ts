export type BillingKind = 'ACCOUNT' | 'ACCOUNT_HISTORY' | 'INVOICE' | 'PAYMENT' | 'PAYMENT_ALLOCATION' | 'RECEIPT' | 'CREDIT_NOTE'
  | 'REFUND' | 'STATEMENT' | 'BANK_ENTRY' | 'RECONCILIATION' | 'SCHEDULE' | 'OUTBOX' | 'TAX_RULE' | 'SERIES' | 'AUDIT';
export interface BillingRecord {
  id: string;
  companyId: number;
  companyName: string;
  kind: BillingKind;
  key: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  data: Record<string, unknown>;
}
export interface BillingCursor { id: string; createdAt: string }
export interface BillingPage { items: BillingRecord[]; next: BillingCursor | null }
export interface BillingFilters {
  companyId?: number;
  status?: string;
  from?: string;
  to?: string;
  reference?: string;
  debit?: true;
  recurring?: true;
  overdue?: true;
  unallocated?: true;
}
export interface BillingTotals {
  currency: string;
  invoiced: string;
  paid: string;
  outstanding: string;
  received: string;
  credits: string;
  refunded: string;
  unapplied?: string;
  ageing: string[];
  trend: { invoiced: string; received: string }[];
}
export interface BillingOverview {
  months: string[];
  totals: BillingTotals[];
  invoiceStatuses: Record<string, number>;
  alerts: { overdue: number; pendingPayments: number; failedEvents: number; unmatched: number };
  providers: { provider: string; currency: string; count: number; confirmed: string }[];
}
export interface BillingAccount {
  company: { id: number; name: string; nif: string | null };
  balances: BillingTotals[];
  invoices: number;
  overdue: number;
}
export interface BillingLine {
  description: string;
  quantity: number | null;
  unitPrice: string;
  discount: string;
  taxBasisPoints: number | null;
  taxRuleVersion: string;
}
