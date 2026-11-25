import type { ScenarioType } from './simulations.navigation';

export interface Adjustment {
  employeeId?: string;
  componentCode: string;
  operation: 'SET' | 'ADD' | 'SUBTRACT' | 'PERCENT_INCREASE' | 'PERCENT_DECREASE';
  value: string;
  effectiveFrom?: string;
  effectiveTo?: string;
}

export interface ScenarioConfiguration {
  period: { startDate: string; endDate: string };
  employeeIds?: string[];
  excludeEmployeeIds?: string[];
  departmentId?: number;
  jobCategory?: string;
  adjustments: Adjustment[];
  baselinePayrollRunId?: string | null;
  assumptions?: Record<string, unknown>;
}

export interface ScenarioDraft {
  name: string;
  type: ScenarioType;
  configuration: ScenarioConfiguration;
}

export interface Scenario extends ScenarioDraft {
  id: string;
  status: string;
  version: number;
  updatedAt: string;
}
export interface Version {
  id: string;
  version: number;
  configuration: ScenarioConfiguration;
  createdAt: string;
}

export interface Run {
  id: string;
  scenarioId: string;
  scenarioVersion: number;
  type: ScenarioType;
  status: string;
  period: ScenarioConfiguration['period'];
  createdAt: string;
  totals?: { gross: string; deductions: string; net: string; employerCosts: string };
  employeeCount?: number;
  employeeIds?: string[];
  executionScope?: 'bulk' | 'individual';
  failedCount?: number;
}
export interface Progress {
  total: number;
  completed: number;
  failed: number;
}
export interface ResultLine {
  employeeId: string;
  status: string;
  result?: { grossAmount: string; deductionsAmount: string; netAmount: string; employerCostsAmount: string; currency: string };
  issue?: { code: string; message: string };
}
export interface RunResults { run: Run; items: ResultLine[] }
export interface Explanation {
  employeeId: string;
  engineVersion: string;
  legalRuleSetVersion: string;
  lines: unknown;
}
export interface Comparison {
  id: string;
  comparison: { employeeId: string; affected: boolean; differences: Record<string, {
    base: string; compared: string; difference: string; percentage: number | null;
  }> }[];
}
export interface Projection {
  id: string;
  total: { gross: string; employer: string; cost: string };
  periods: { month: number; workforce: number; grossAmount: string; netAmount: string;
    employerCharges: string; totalPersonnelCost: string; currency: string }[];
}
export interface Proposal {
  id: string;
  scenarioId: string;
  runId: string;
  status: string;
  reason: string;
  submittedAt: string;
  decisions?: { decision: string; reason: string; decidedAt: string }[];
}
export type ExportFormat = 'PDF' | 'XLSX' | 'CSV';
export interface ExportRecord {
  id: string;
  runId: string;
  filename: string;
  status: string;
  format: ExportFormat;
  rowCount: number;
  createdAt: string;
}
export interface Oversight {
  company: { id: number; name: string };
  scenarios: Record<string, number>;
  runs: Record<string, number>;
  proposals: Record<string, number>;
}
