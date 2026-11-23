export const LEAVE_STATUSES = {
  DRAFT: 'Draft', PENDING_APPROVAL: 'Pending approval', RETURNED: 'Returned',
  APPROVED: 'Approved', REJECTED: 'Rejected', IN_PROGRESS: 'In progress',
  PARTIALLY_COMPLETED: 'Partially completed', INTERRUPTED: 'Interrupted',
  COMPLETED: 'Completed', CANCELLED: 'Cancelled',
} as const;

export type LeaveStatus = keyof typeof LEAVE_STATUSES;
export const LEAVE_TYPES = {
  ANNUAL: 'Annual leave', SICK: 'Sick leave', SPECIAL: 'Special leave', UNPAID: 'Unpaid leave', OTHER: 'Other leave',
} as const;
export type LeaveType = keyof typeof LEAVE_TYPES;

export interface Segment { startDate: string; endDate: string }
export interface LeavePeriod extends Segment { id: string; calculatedDays: number }
export interface LeaveDecision {
  id: number | null;
  approverUserId: number;
  decision: 'APPROVED' | 'REJECTED' | 'RETURNED';
  comments: string | null;
  decidedAt: string;
}
export interface LeaveRequest extends Segment {
  id: string;
  employeeId: string;
  accountId: string;
  status: LeaveStatus;
  leaveType: LeaveType;
  requestedDays: number;
  reason: string | null;
  createdByUserId: number;
  version: number;
  periods: LeavePeriod[];
  approvals: LeaveDecision[];
  submittedAt: string | null;
  decidedAt: string | null;
  createdAt: string;
}
export interface DraftInput {
  leaveType: LeaveType;
  reason: string | null;
  segments: Segment[];
}
export interface RequestFilter {
  employeeId?: string;
  status?: LeaveStatus;
  leaveType?: LeaveType;
  startDate?: string;
  endDate?: string;
}
export interface ReportFilter { employeeId?: string; startDate?: string; endDate?: string }
export interface LeaveAccount {
  id: string;
  employeeId: string;
  status: 'ACTIVE' | 'CLOSED';
  version: number;
}
export interface LeaveBalance {
  accountId: string;
  employeeId: string;
  entitled: number;
  adjusted: number;
  reserved: number;
  used: number;
  available: number;
}
export const MOVEMENTS = ['ACCRUAL', 'ADJUSTMENT', 'RESERVATION', 'RELEASE', 'USAGE'] as const;
export type MovementType = typeof MOVEMENTS[number];
export interface Movement {
  id: number;
  movementType: MovementType;
  days: number;
  reason: string | null;
  referenceId: string | null;
  actorUserId: number | null;
  createdAt: string;
}
export interface EntitlementInput {
  accrualPeriodStart: string;
  accrualPeriodEnd: string;
  days: number;
  legalRuleVersionId: string | null;
}
export interface Entitlement extends EntitlementInput { id: string; createdAt: string }
export interface LeaveConflict {
  conflictingRequestId: string;
  conflictingStatus: LeaveStatus;
  overlapStart: string;
  overlapEnd: string;
}
export interface LeaveAbsence extends Segment {
  employeeId: string;
  requestId: string;
  status: LeaveStatus;
}
export interface EmployeeReference {
  id: string;
  firstName: string;
  lastName: string;
  employeeNumber: string;
  departmentId: string | number | null;
  status: string;
}
export interface OrganizationReference { id: string; name: string; data: Record<string, unknown> }
export interface CalendarPreview {
  workingDays: number;
  calendar: { workingWeekdays: number[]; exceptions: Record<string, 'WORKING_DAY' | 'NON_WORKING_DAY'> };
}
export interface LeaveAuditEvent {
  id: string;
  actorId: string | null;
  action: string;
  resourceId: string;
  occurredAt: string;
  outcome: string;
}

export const ACTIONS = {
  submit: { label: 'Submit for approval', permission: 'submit', states: ['DRAFT', 'RETURNED'] },
  approve: { label: 'Approve and reserve days', permission: 'approve', states: ['PENDING_APPROVAL'] },
  reject: { label: 'Reject', permission: 'reject', states: ['PENDING_APPROVAL'] },
  return: { label: 'Return', permission: 'return', states: ['PENDING_APPROVAL'] },
  cancel: { label: 'Cancel request', permission: 'cancel', states: ['DRAFT', 'RETURNED', 'PENDING_APPROVAL', 'APPROVED'] },
  reschedule: { label: 'Reschedule', permission: 'manage', states: ['APPROVED', 'IN_PROGRESS'] },
  start: { label: 'Record start', permission: 'manage', states: ['APPROVED'] },
  interrupt: { label: 'Record interruption', permission: 'manage', states: ['IN_PROGRESS'] },
  complete: { label: 'Confirm days taken', permission: 'manage', states: ['APPROVED', 'IN_PROGRESS', 'INTERRUPTED', 'PARTIALLY_COMPLETED'] },
} as const satisfies Record<string, { label: string; permission: string; states: readonly LeaveStatus[] }>;
export type LeaveAction = keyof typeof ACTIONS;
