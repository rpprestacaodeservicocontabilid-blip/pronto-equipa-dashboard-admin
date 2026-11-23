export type ReportCode = 'REPORT_ACTIVITY' | 'DOMAIN_USAGE' | 'PAYSLIP_ACTIVITY' | 'ONBOARDING_ACTIVITY' | 'PAYROLL_ACTIVITY' | 'PAYMENT_ACTIVITY';
export type Grouping = 'day' | 'month';
export type Format = 'CSV' | 'XLSX' | 'PDF';
export type Cadence = 'DAILY' | 'WEEKLY' | 'MONTHLY';
export interface Scope { from: string; to: string; grouping: Grouping; companyId?: number }
export interface ReportRequest { code: ReportCode; scope: Scope }
export interface Definition {
  code: ReportCode; title: string; category: string; companyFilter: boolean;
  source: string; description: string; version: number;
}
export interface Observation { period: string; category: string; state: string; count: number }
export interface Preview {
  rows: Observation[]; capturedAt: string;
  comparison?: { scope: Scope; rows: Observation[] };
}
export interface Page<T> { items: T[]; total: number; page: number; limit: number }
interface Entry { id: string; status: string; createdAt: string; updatedAt: string; dueAt: string | null }
export interface Execution extends Entry, ReportRequest {
  version: number; rowCount: number; failure?: string; durationMs?: number; scheduleId?: string;
}
export interface ExecutionResult extends Execution { rows: Observation[] }
export interface Export extends Entry { executionId: string; format: Format; filename: string; rowCount: number }
export interface Template extends Entry, ReportRequest { title: string; rootId: string; version: number }
export interface ScheduleInput {
  title: string; code: ReportCode; cadence: Cadence; grouping: Grouping; companyId?: number;
}
export interface Schedule extends Entry, ScheduleInput { lastExecutionId?: string; lastState?: string }
export interface Policy { version: number; maxDays: number; exportHours: number }
export interface ReportPolicy { current: Policy; history: (Policy & { id: string; reason: string; createdAt: string })[] }
export interface AuditEntry { id: number; action: string; reference: string | null; createdAt: string }
export interface Company { id: number; name: string }

const labels: Record<string, string> = {
  HR: 'Human resources', CUSTOM_REPORT: 'Custom report', XLSX: 'Excel', CSV: 'CSV', PDF: 'PDF',
  REPORT_SOURCE_UNAVAILABLE: 'The source could not be reached',
  REPORT_LIMIT_EXCEEDED: 'The report exceeded the result limit',
};
export function label(value: string) {
  const words = value.replace(/^platform\.reports\./, '').replace(/[_.-]/g, ' ').toLowerCase();
  return labels[value] ?? words.charAt(0).toUpperCase() + words.slice(1);
}

export function currentScope(): Scope {
  const now = Date.now() + 3600000;
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  return { from: iso(now - 29 * 86400000), to: iso(now), grouping: 'month' };
}
