import { PayrollRun, RunAction, RunStatus } from './payroll.models';

export interface PayrollAction {
  id: RunAction;
  label: string;
  permission: string;
  statuses: RunStatus[];
  confirmation?: string;
}
export const PAYROLL_ACTIONS: PayrollAction[] = [
  { id: 'validate', label: 'Queue pre-validation', permission: 'payroll:runs:validate', statuses: ['DRAFT', 'VALIDATION_FAILED'] },
  { id: 'process', label: 'Start processing', permission: 'payroll:runs:process', statuses: ['VALIDATING'] },
  { id: 'retry-failed', label: 'Retry failed calculations', permission: 'payroll:runs:retry', statuses: ['PARTIALLY_PROCESSED', 'FAILED'] },
  { id: 'submit', label: 'Submit for approval', permission: 'payroll:approvals:submit', statuses: ['READY_FOR_REVIEW'] },
  { id: 'approve', label: 'Approve run', permission: 'payroll:approvals:approve', statuses: ['SUBMITTED'],
    confirmation: 'Confirm this payroll run has been reviewed and is ready for approval.' },
  { id: 'reject', label: 'Reject run', permission: 'payroll:approvals:reject', statuses: ['SUBMITTED'],
    confirmation: 'Give a reason for rejecting this run.' },
  { id: 'close', label: 'Close payroll run', permission: 'payroll:closing:execute', statuses: ['APPROVED'],
    confirmation: 'Closing locks the payroll results. Any correction will require a new run.' },
  { id: 'payment-instructions', label: 'Prepare payment instructions', permission: 'payroll:payments:prepare', statuses: ['CLOSED'],
    confirmation: 'Prepare instructions for the payments module. The instructions will be listed here when available.' },
  { id: 'cancel', label: 'Cancel run', permission: 'payroll:runs:cancel',
    statuses: ['DRAFT', 'VALIDATING', 'VALIDATION_FAILED', 'READY_FOR_REVIEW', 'PARTIALLY_PROCESSED', 'FAILED', 'REJECTED'],
    confirmation: 'Confirm you want to cancel this execution.' },
];

const FINANCIAL = new Set<RunAction>(['submit', 'approve', 'reject', 'close', 'payment-instructions']);
export function availablePayrollActions(
  run: PayrollRun, grants: string[], actor: string | undefined, waitingForValidation: boolean,
) {
  return PAYROLL_ACTIONS.filter(action =>
    action.statuses.includes(run.status) && grants.includes(action.permission) &&
    !(FINANCIAL.has(action.id) && run.runType === 'SIMULATION') &&
    !((action.id === 'approve' || action.id === 'reject') && actor === String(run.createdBy)) &&
    !(action.id === 'process' && waitingForValidation));
}
