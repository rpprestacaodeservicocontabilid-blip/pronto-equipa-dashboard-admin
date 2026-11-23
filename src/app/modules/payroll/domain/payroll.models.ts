import type { EngineIssue, EngineLine, EngineTrace } from '../../payroll-engine/domain/engine.models';

export const RUN_TYPES = ['REGULAR', 'OFF_CYCLE', 'SUPPLEMENTARY', 'RETROACTIVE', 'CORRECTION', 'TERMINATION', 'SIMULATION'] as const;
export const RUN_STATUSES = [
  'DRAFT', 'VALIDATING', 'VALIDATION_FAILED', 'PROCESSING', 'PARTIALLY_PROCESSED', 'FAILED',
  'READY_FOR_REVIEW', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CLOSED', 'CANCELLED',
] as const;
export const RUN_TITLES: Record<RunType, string> = {
  REGULAR: 'Regular', OFF_CYCLE: 'Off-cycle', SUPPLEMENTARY: 'Supplementary', RETROACTIVE: 'Retroactive',
  CORRECTION: 'Correction', TERMINATION: 'Termination', SIMULATION: 'Simulation',
};
export type RunType = typeof RUN_TYPES[number];
export type RunStatus = typeof RUN_STATUSES[number];
export type ExecutionScope = 'INDIVIDUAL' | 'COLLECTIVE';
export type PeriodStatus = 'DRAFT' | 'OPEN' | 'CLOSED';
export type RunAction = 'validate' | 'process' | 'retry-failed' | 'cancel' | 'submit' | 'approve' | 'reject' | 'close' | 'payment-instructions';
export type ReportType = 'summary' | 'deductions' | 'employer-costs';
export type ExportFormat = 'PDF' | 'XLSX';

export interface PayrollPage<T> { data: T[]; total: number; page: number; limit: number }
export interface PeriodDates { startDate: string; endDate: string; paymentDate: string }
export interface PayrollPeriod extends PeriodDates {
  id: string;
  status: PeriodStatus;
  version: number;
}
export interface PayrollRun {
  id: string;
  periodId: string;
  runType: RunType;
  executionScope: ExecutionScope;
  employeeIds: string[];
  status: RunStatus;
  version: number;
  originalRunId: string | null;
  reason: string | null;
  createdBy: number;
  createdAt: string;
}
export interface NewRun {
  periodId: string;
  runType: RunType;
  executionScope: ExecutionScope;
  employeeIds: string[];
  idempotencyKey: string;
  originalRunId?: string;
  reason?: string;
}
export interface PayrollProgress { status: RunStatus; version: number; totalItems: number; completedItems: number; failedItems: number }
export interface PayrollAmounts {
  currency: string;
  grossAmount: string;
  deductionsAmount: string;
  netAmount: string;
  employerCostsAmount: string;
}
export type PayrollSummary = { employees: 0; currency?: undefined } | ({ employees: number } & PayrollAmounts);
export interface PayrollResult extends PayrollAmounts {
  id: string;
  runId: string;
  employeeId: string;
}
export type PayrollLine = EngineLine;
export interface PayrollExplanation extends PayrollAmounts {
  employeeId?: string;
  engineVersion: string;
  legalRuleSetVersion: string;
  calculationTraceId: string;
  inputHash?: string;
  inputSnapshotId?: string;
  calculationTrace?: EngineTrace;
  issues?: EngineIssue[];
  lines: PayrollLine[];
}
export interface WorkflowRecord<T> {
  id: string;
  employeeId: string | null;
  status: string;
  createdAt: string;
  version: number;
  data: T;
}
export type PayrollIssue = WorkflowRecord<{ code?: string; severity?: string; message?: string }>;
export type PayrollApproval = WorkflowRecord<{ actorUserId: number; reason: string | null; runVersion: number; requiredApprovals?: number }>;
export type PayrollClosing = WorkflowRecord<{
  totals: PayrollAmounts & { employees: number };
  closedAt: string;
  closedBy: number;
  closingHash: string;
}>;
export type PayrollInstruction = WorkflowRecord<{ amount: string; currency: string; reference: string; resultId: string }>;
export type PayrollPolicy = WorkflowRecord<{ code: string; requiredApprovals: number; actorUserId: number }>;
export type SummaryReportRow = PayrollAmounts & { runId: string; runType: RunType; employees: number };
export type LineReportRow = PayrollLine & { runId: string; employeeId: string; currency?: string };
export interface PayrollComparison { employeeId: string; currency: string; netDifference: string }
export interface PayrollExport { id: string; status: string }
export interface PayrollEmployee { id: string; employeeNumber: string; firstName: string; lastName: string; status: string }

export function isAdjustment(type: RunType) {
  return type === 'CORRECTION' || type === 'SUPPLEMENTARY' || type === 'RETROACTIVE';
}
