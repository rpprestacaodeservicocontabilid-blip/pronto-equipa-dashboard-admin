import type { PayrollExplanation } from '../../payroll/domain/payroll.models';
import type { EngineEvidence } from './engine.models';

export function savedEngineEvidence(explanation: PayrollExplanation, employeeId?: string): EngineEvidence {
  const trace = explanation.calculationTrace;
  return {
    employeeId: employeeId ?? explanation.employeeId,
    currency: explanation.currency,
    inputSnapshotId: explanation.inputSnapshotId,
    lines: explanation.lines,
    issues: explanation.issues,
    trace: {
      ...trace,
      calculationTraceId: trace?.calculationTraceId ?? explanation.calculationTraceId,
      engineVersion: trace?.engineVersion ?? explanation.engineVersion,
      legalRuleSetVersion: trace?.legalRuleSetVersion ?? explanation.legalRuleSetVersion,
      inputHash: explanation.inputHash ?? trace?.inputHash,
    },
  };
}
