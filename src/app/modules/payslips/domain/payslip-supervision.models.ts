export const RECEIPT_TYPES = ['REGULAR', 'OFF_CYCLE', 'SUPPLEMENTARY', 'RETROACTIVE', 'CORRECTION', 'TERMINATION', 'DUPLICATE_COPY'] as const;
export const RECEIPT_STATUSES = ['PENDING', 'GENERATING', 'GENERATED', 'VALIDATED', 'PUBLISHED', 'SUPERSEDED', 'GENERATION_FAILED', 'PUBLICATION_FAILED', 'ARCHIVED'] as const;
export const BATCH_STATUSES = ['PENDING', 'STARTED', 'COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED'] as const;
export type ReceiptType = typeof RECEIPT_TYPES[number];
export type ReceiptStatus = typeof RECEIPT_STATUSES[number];
export type DateGrouping = 'month' | 'day';
export interface Company { id: number; name: string }
export interface DateRange { companyId?: number; from: string; to: string }
export interface VolumeFilter extends DateRange { granularity: DateGrouping; type?: ReceiptType; status?: ReceiptStatus }
export interface Page<T> { items: T[]; page: number; limit: number; total: number }
export interface CompanyPage<T> extends Page<T> { company: Company }
export interface Count { status: string; total: number }
export interface Metric extends Count { category: 'receipts' | 'batches' | 'publication' | 'storage' | 'publications' | 'portal' | 'delivery' | 'integrity' }

export interface Overview {
  range: DateRange;
  companyCount: number;
  generated: number;
  published: number;
  pending: number;
  failed: number;
  archived: number;
  metrics: Metric[];
}

export interface VolumeRow { period: string; type: string; status: string; total: number }
export interface AuditRow { period: string; event: string; total: number }
export interface Batch {
  id: string;
  companyId: number;
  status: string;
  type: string;
  createdAt: string;
  updatedAt: string;
  total: number;
  completed: number;
  failed: number;
}
export interface BatchDetails extends Batch { company: Company; progress: Count[] }

export interface TemplateVersion {
  id: string;
  templateId: string | null;
  version: string | null;
  status: string;
  createdAt: string;
}
export interface Policy {
  id: string;
  version: number;
  status: string;
  createdAt: string;
  retentionDays: number | null;
  allowWorkerDownload: boolean | null;
  notifyWorkerOnPublish: boolean | null;
  requireManualPublication: boolean | null;
}

const labels: Record<string, string> = {
  REGULAR: 'Monthly', OFF_CYCLE: 'Off-cycle', DUPLICATE_COPY: 'Duplicate copy',
  OTHER: 'Other', STARTED: 'In progress', PARTIALLY_COMPLETED: 'Completed with issues',
  MATCH: 'Hash matched', MISMATCH: 'Hash mismatch', PUBLISHED: 'Published',
  'access.VIEW': 'Employee portal view', 'access.DOWNLOAD': 'File downloaded',
  'access.PRINT': 'File printed', 'access.PREVIEW': 'File previewed', 'access.VERIFY': 'Integrity checked',
};
export function label(value: string) {
  const words = value.replace(/^payslips\./, '').replace(/[_.-]/g, ' ').toLowerCase();
  return labels[value] ?? words.charAt(0).toUpperCase() + words.slice(1);
}

export function currentRange(): DateRange {
  const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const now = Date.now() + 3600000;
  return { from: day(now - 29 * 86400000), to: day(now) };
}
