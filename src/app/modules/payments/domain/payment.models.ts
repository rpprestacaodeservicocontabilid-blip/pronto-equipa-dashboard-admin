export type PaymentDirectory =
  'instructions' | 'orders' | 'batches' | 'transactions' | 'returns' | 'reconciliations' |
  'integrations' | 'files' | 'policies' | 'audit';

export type PaymentView = PaymentDirectory | 'overview' | 'providers' | 'reports' | 'settings';
export type Incident = 'pending' | 'failed';
export type Breakdown = 'status' | 'company' | 'provider';

export interface PaymentFilters {
  companyId?: number;
  from?: string;
  to?: string;
  providerId?: string;
  status?: string;
}

export interface PaymentRow {
  id: string | number;
  companyId?: number | null;
  companyName?: string | null;
  status?: string | null;
  [field: string]: string | number | boolean | null | undefined;
}

export interface PaymentPage {
  items: PaymentRow[];
  total: number;
  page: number;
  limit: number;
}

export interface PaymentDetail {
  record: PaymentRow;
  history?: PaymentRow[];
  historyTotal?: number;
  progress?: { status: string; count: string | number }[];
}

export interface PaymentOverview {
  totals: { currency: string; amount: string }[];
  confirmed: number;
  pending: number;
  failed: number;
  returns: number;
  companies: number;
  batches: number;
  reconciliations: number;
}

export interface Provider {
  id: string;
  name: string;
  type: string;
  capabilities: string[];
}

export interface PaymentReportRow {
  currency: string;
  count: number;
  amount: string;
  status?: string;
  companyId?: number;
  companyName?: string | null;
  providerId?: string;
}

export interface PaymentReport {
  items: PaymentReportRow[];
  page: number;
  hasNext: boolean;
}
