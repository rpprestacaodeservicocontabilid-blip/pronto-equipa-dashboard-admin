import { CompanyPaymentView } from './company-payments.navigation';

export type Directory = Exclude<CompanyPaymentView, 'overview' | 'statements' | 'policies' | 'reports'>;
export interface CompanyPaymentRow {
  id: string; status?: string; currency?: string; amount?: string; code?: string; totalAmount?: string;
  instructionId?: string; sourceAccountId?: string; providerId?: string; createdBy?: number;
  accountName?: string; bankCode?: string; accountIdentifier?: string; isPrimary?: boolean;
  beneficiary?: { name: string; bankCode: string; accountNumber: string };
  items?: CompanyPaymentRow[]; [key: string]: unknown;
}
export interface CompanyPaymentPage { data: CompanyPaymentRow[]; page: number; limit: number; total: number }
export interface CompanyPaymentSummary {
  byCurrency: { currency: string; authorized: string; confirmed: string }[];
  pendingPayments: number; failedPayments: number;
}
export interface CompanyProvider { id: string; name: string; type: string; capabilities: string[] }
export interface CompanyPaymentPolicy { baseApprovals: number; highValueThreshold: string | null; highValueApprovals: number | null }
export interface PaymentExport { fileName: string; content: string }
export interface StatementImport { id: string; rowCount: number; status: string }
export const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
export const paymentAmount = /^(0|[1-9]\d{0,15})(\.\d{1,2})?$/;
