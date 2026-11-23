export const ROUNDING_MODES = [
  { id: 'HALF_UP', label: 'Nearest cent, ties away from zero' },
  { id: 'HALF_EVEN', label: 'Nearest cent, ties to even' },
  { id: 'DOWN', label: 'Toward zero' },
  { id: 'UP', label: 'Away from zero' },
] as const;

export type RoundingMode = typeof ROUNDING_MODES[number]['id'];

export interface EngineScenario {
  month: string;
  baseSalary: string;
  allowance: string;
  annualAllowance: string;
  deduction: string;
  deductionAuthorized: boolean;
  rounding: RoundingMode;
}

export interface EngineLine {
  code: string;
  type: 'EARNING' | 'DEDUCTION' | 'EMPLOYER_COST';
  amount: string;
  sourceReference: string;
  requestedAmount?: string;
  remainingAmount?: string;
  formula?: string;
}

export interface EngineIssue {
  severity: 'WARNING' | 'BLOCKING';
  code: string;
  message: string;
  sourceReference?: string;
}

export interface EngineStep {
  code: string;
  description: string;
  amount?: string;
  formula?: string;
}

export interface EngineTrace {
  calculationTraceId?: string;
  engineVersion?: string;
  legalRuleSetId?: string;
  legalRuleSetVersion?: string;
  legalSourceReference?: string;
  inputHash?: string;
  calculationInputHash?: string;
  resultHash?: string;
  roundingPolicy?: { mode: RoundingMode; scale: number };
  steps?: EngineStep[];
}

export interface EngineEvidence {
  currency: string;
  employeeId?: string;
  inputSnapshotId?: string;
  lines: EngineLine[];
  issues?: EngineIssue[];
  trace: EngineTrace;
}

export interface EngineSimulation extends EngineEvidence {
  grossAmount: string;
  taxableAmount: string;
  contributionBase: string;
  totalDeductions: string;
  netAmount: string;
  employerCostsAmount: string;
  totalEmployerCost: string;
}

export const SAMPLE_SCENARIO: Readonly<EngineScenario> = {
  month: '2026-11',
  baseSalary: '100000.00',
  allowance: '7500.00',
  annualAllowance: '30000.00',
  deduction: '5000.00',
  deductionAuthorized: true,
  rounding: 'HALF_EVEN',
};

export function normalizeScenario(value: EngineScenario): EngineScenario | null {
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(value.month)) return null;
  const normalize = (amount: string) => amount.trim().replace(',', '.');
  const scenario = {
    ...value,
    baseSalary: normalize(value.baseSalary),
    allowance: normalize(value.allowance),
    annualAllowance: normalize(value.annualAllowance),
    deduction: normalize(value.deduction),
  };
  const decimal = /^(0|[1-9]\d{0,11})(?:\.\d{1,6})?$/;
  return [scenario.baseSalary, scenario.allowance, scenario.annualAllowance, scenario.deduction]
    .every(amount => decimal.test(amount)) ? scenario : null;
}
