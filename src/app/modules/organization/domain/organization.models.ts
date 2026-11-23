export type OrganizationStatus = 'ACTIVE' | 'INACTIVE';
export type Resource = 'departments' | 'job-functions' | 'job-positions' | 'professional-categories'
  | 'cost-centers' | 'cost-allocations' | 'establishments' | 'calendars' | 'schedules';
export type ChildResource = 'employees' | 'exceptions' | 'shifts';

export interface OrganizationInput {
  code: string;
  name: string;
  parentId?: string | null;
  relatedId?: string | null;
  employeeId?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  data: Record<string, unknown>;
}

export interface OrganizationRecord extends OrganizationInput {
  id: string;
  companyId: number;
  status: OrganizationStatus;
  version: number;
  type: string;
  percentage?: number | string | null;
}

export interface DepartmentNode extends OrganizationRecord {
  children: DepartmentNode[];
}

export interface OrganizationHistory {
  id: number;
  entityId: string;
  changeType: string;
  actorUserId: number | null;
  previousData: OrganizationRecord | null;
  newData: OrganizationRecord;
  createdAt: string;
}

export interface OrganizationQuery {
  search?: string;
  status?: OrganizationStatus;
  relatedId?: string;
}

export interface CostAllocations {
  employeeId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  allocations: { costCenterId: string; percentage: number }[];
}

export interface Shift {
  weekday: number;
  startTime: string;
  endTime: string;
  crossesMidnight: boolean;
  breakMinutes: number;
}

export interface AuditEvent {
  id: string;
  action: string;
  actorId: string | null;
  resourceType: string;
  resourceId: string | null;
  occurredAt: string;
  outcome: string;
}
