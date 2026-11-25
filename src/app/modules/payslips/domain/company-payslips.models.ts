import { ReceiptStatus, ReceiptType } from './payslip-supervision.models';

export type Filter = { page: number; limit: number; status?: ReceiptStatus; type?: ReceiptType; employeeId?: string };
export interface ReceiptPage { data: CompanyReceipt[]; total: number; page: number; limit: number }
export interface ChoicePage<T> { items: T[]; more: boolean }
export interface Period { startDate: string; endDate: string }
export interface CompanyReceipt {
  id: string; number: string; type: ReceiptType; status: ReceiptStatus; employeeId: string;
  payrollRunId: string; originalPayslipId?: string; supersededBy?: string; issuedAt: string;
  grossAmount: string; totalDeductions: string; netAmount: string; currency: string;
  snapshot?: { employer: { name: string; taxId: string }; employee: { fullName: string; employeeCode: string };
    period: Period; earnings: Line[]; deductions: Line[]; legalRuleSetVersion?: string };
}
export interface Line { code: string; description: string; amount: string }
export interface ClosedRun { id: string; runType: Exclude<ReceiptType, 'DUPLICATE_COPY'>; originalRunId: string | null; period?: Period }
export interface EmployeeResult { id: string; employeeId: string; name: string | null; employeeCode: string | null }
export interface PublishedVersion { id: string; name: string; version: string }
export interface Issuance {
  payrollRunId: string; templateVersionId: string; type: ClosedRun['runType']; results: EmployeeResult[]; reason?: string;
}
export interface BatchItem { id: string; employeeId: string; status: string; errorCode?: string; payslipId?: string }
export interface CompanyBatch {
  id: string; payrollRunId: string; type: ReceiptType; status: string; createdAt: string;
  totalItems: number; completedItems: number; failedItems: number; items?: BatchItem[];
}
export interface BatchProgress { total: number; completed: number; failed: number; pending: number; status: string }
export interface CompanyTemplate { id: string; code: string; name: string; description?: string; versions?: CompanyTemplateVersion[] }
export interface CompanyTemplateVersion { id: string; version: string; status: string; layoutConfig: { title?: string } }
export interface CompanyPayslipPolicy {
  version: number; retentionDays: number | null; allowWorkerDownload: boolean;
  notifyWorkerOnPublish: boolean; requireManualPublication: boolean;
}
export interface Summary { totalGenerated: number; published: number; pending: number; failed: number }
export interface Verification { status: string; documentHash: string; verifiedAt: string }
export interface ReceiptEvent { type?: string; action?: string; at?: string; publishedAt?: string; accessedAt?: string; createdAt?: string }
export interface Correction { id: string; originalPayslipId: string; correctionPayslipId: string; reason: string; createdAt: string }
export const uuid = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
