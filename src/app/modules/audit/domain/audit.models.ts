export const auditCategories = [
  'ACTIVITY', 'SECURITY', 'ACCESS', 'DATA_CHANGE', 'ADMINISTRATION', 'FINANCIAL', 'PAYROLL',
  'DOCUMENT', 'AUTHORIZATION', 'INTEGRATION', 'AUTOMATION', 'COMPLIANCE', 'EXPORT', 'AI_OPERATION',
] as const;
export const auditSeverities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
export const auditOutcomes = ['SUCCESS', 'FAILURE', 'DENIED', 'PARTIAL', 'CANCELLED'] as const;
export type AuditCategory = typeof auditCategories[number];
export type AuditSeverity = typeof auditSeverities[number];
export type AuditOutcome = typeof auditOutcomes[number];

export interface AuditFilters {
  module?: string;
  action?: string;
  eventType?: string;
  category?: AuditCategory;
  severity?: AuditSeverity;
  outcome?: AuditOutcome;
  actorId?: string;
  resourceType?: string;
  resourceId?: string;
  correlationId?: string;
  from?: string;
  to?: string;
}

export interface AuditRecord {
  id: string;
  sequence: number;
  module: string;
  action: string;
  eventType: string;
  category: AuditCategory;
  severity: AuditSeverity;
  outcome: AuditOutcome;
  occurredAt: string;
  receivedAt: string;
  actorId: string | null;
  resourceType: string;
  resourceId: string;
  correlationId: string | null;
  policyVersion: number;
  sensitivity: 'STANDARD' | 'SENSITIVE';
  previousHash: string;
  payloadHash: string;
  recordHash: string;
  payload: {
    actor: { actorId?: string; actorType: string };
    reason?: string;
    metadata?: Record<string, unknown>;
    changes?: { field: string; before?: unknown; after?: unknown }[];
  };
}

export interface AuditRecordPage {
  data: AuditRecord[];
  nextCursor: number | null;
  throughSequence: number;
}

export interface AuditDashboard {
  events: number;
  critical: number;
  denied: number;
  failures: number;
  withoutCorrelation: number;
  categories: Record<string, number>;
  asOfSequence: number;
  daily?: Array<{ date: string; events: number }>;
}

export interface AuditObject {
  id: string;
  kind: string;
  key: string;
  status: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AuditObjectPage { items: AuditObject[]; total: number }
export interface AuditScope { purpose: string; companyId?: number }
export interface AuditChecks { valid: boolean; checksum?: string; throughSequence?: number; assurance?: string }
export interface AuditMetrics {
  openAlerts: number;
  ingestionLagMs: number;
  retries: number;
  deadLetters: number;
  pendingOutbox: number;
  deadOutbox: number;
  publishedEvents: number;
  pendingExports: number;
  lastCheckpointAt: string | null;
  storage: Record<string, unknown>;
}

export function auditLabel(value: string): string {
  return value.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
}
