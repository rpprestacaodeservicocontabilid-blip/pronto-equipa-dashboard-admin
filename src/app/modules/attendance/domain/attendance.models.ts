export const PUNCH_TYPES = { IN: 'Clock in', OUT: 'Clock out', BREAK_START: 'Break start', BREAK_END: 'Break end' } as const;
export type PunchType = keyof typeof PUNCH_TYPES;

export interface PunchInput {
  employeeId: string;
  punchType: PunchType;
  occurredAt: string;
  workDate?: string;
  deviceId?: string;
  externalReference?: string;
  idempotencyKey?: string;
}

export interface Punch extends PunchInput {
  id: string;
  workDate: string;
  source: string;
  timezone: string;
  correctionOfId: string | null;
  createdAt: string;
  createdBy: number;
}

export interface AttendanceEntity {
  id: string;
  type: string;
  employeeId: string | null;
  workDate: string | null;
  parentId: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  status: string;
  version: number;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
  data: {
    workedMinutes?: number;
    expectedMinutes?: number;
    occurrences?: { type: string; status: string; durationMinutes: number }[];
    calculatedAt?: string;
    scheduleId?: string;
    policyVersion?: number;
    punchIds?: string[];
    occurrenceType?: string;
    durationMinutes?: number;
    toleranceMinutes?: number;
    justificationId?: string;
    reason?: string;
    evidence?: string;
    decisionReason?: string;
    decidedAt?: string;
    decidedBy?: number;
    originalPunchType?: PunchType;
    requestedPunchType?: PunchType;
    originalOccurredAt?: string;
    requestedOccurredAt?: string;
    replacementId?: string;
    periodId?: string;
    validation?: {
      pendingByType: Partial<Record<string, number>>;
      uncalculatedDays: number;
      staleDays: number;
      dayCount: number;
      validatedAt: string;
    };
    closedAt?: string;
    dayCount?: number;
    days?: AttendanceEntity[];
    totalRows?: number;
    importedRows?: number;
    errorRows?: number;
    row?: number;
    error?: string;
    punchId?: string;
  };
}

export type AttendanceResource = 'punches' | 'days' | 'occurrences' | 'justifications' | 'corrections' | 'periods';
export type AttendanceRow = Punch | AttendanceEntity;
export interface AttendancePage<T> { data: T[]; total: number; page: number; limit: number }
export interface AttendanceFilter { employeeId?: string; from?: string; to?: string }
export interface Summary {
  from: string;
  to: string;
  dayCount: number;
  workedMinutes: number;
  expectedMinutes: number;
  statuses: Record<string, number>;
}
export interface ImportResult { batch: AttendanceEntity; items: AttendanceEntity[] }
export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  employeeNumber: string;
}
export interface AuditEvent {
  id: string;
  occurredAt: string;
  action: string;
  actorId: string | null;
  resourceId: string | null;
  outcome: string;
}

export function label(value: string | null | undefined) {
  if (!value) return '—';
  return PUNCH_TYPES[value as PunchType] ?? value.toLowerCase().replaceAll('_', ' ').replace(/^./, first => first.toUpperCase());
}

export function isEntity(row: AttendanceRow): row is AttendanceEntity { return 'status' in row; }
