import { AuditFilters } from './audit.models';

export const AUDIT_READ = 'audit:records:read-platform';
export const auditGrant = (code: string) => 'platform:audit:' + code;

export interface AuditSection {
  path: string;
  title: string;
  group: string;
  view: 'dashboard' | 'records' | 'managed' | 'metrics';
  endpoint: string;
  permission: string;
  preset?: AuditFilters;
  company?: boolean;
  lookup?: 'actor' | 'resource' | 'correlation';
  columns?: ReadonlyArray<{ key: string; label: string }>;
}

const records = (path: string, title: string, group: string, preset?: AuditFilters): AuditSection =>
  ({ path, title, group, view: 'records', endpoint: 'records', permission: AUDIT_READ, preset });
const report = (path: string, title: string, endpoint: string): AuditSection =>
  ({ path, title, group: 'Reports', view: 'dashboard', endpoint, permission: auditGrant('reports:read') });
const managed = (path: string, title: string, group: string, endpoint: string, read: string, columns: Record<string, string>): AuditSection =>
  ({ path, title, group, view: 'managed', endpoint, permission: auditGrant(read), columns: Object.entries(columns).map(([key, label]) => ({ key, label })) });

export const AUDIT_SECTIONS: readonly AuditSection[] = [
  { path: 'overview', title: 'Overview', group: 'Overview', view: 'dashboard', endpoint: 'dashboard', permission: AUDIT_READ },
  managed('alerts', 'Alerts', 'Overview', 'admin/alerts', 'alerts:read', { type: 'Type', severity: 'Severity', count: 'Occurrences' }),
  records('records', 'All records', 'Audit records'),
  records('critical', 'Critical records', 'Audit records', { severity: 'CRITICAL' }),
  records('administration', 'Administrative activity', 'Administrative activity', { category: 'ADMINISTRATION' }),
  { ...records('actors', 'Actor activity', 'Administrative activity'), permission: auditGrant('actors:activity'), lookup: 'actor' },
  { ...records('resources', 'Resource history', 'Audit records'), permission: auditGrant('resources:history'), lookup: 'resource' },
  { ...records('correlations', 'Correlation trail', 'Audit records'), permission: auditGrant('correlations:read'), lookup: 'correlation' },
  records('security', 'Authentication and sessions', 'Security', { category: 'SECURITY' }),
  records('denied', 'Denied access', 'Security', { outcome: 'DENIED' }),
  { ...records('companies', 'Company activity', 'Companies'), company: true },
  records('financial', 'Billing and payments', 'Financial operations', { category: 'FINANCIAL' }),
  records('payroll', 'Payroll operations', 'Payroll', { category: 'PAYROLL' }),
  records('documents', 'Document activity', 'Documents', { category: 'DOCUMENT' }),
  records('permissions', 'Roles and privileges', 'Permissions', { category: 'AUTHORIZATION' }),
  records('integrations', 'Technical activity', 'Integrations', { category: 'INTEGRATION' }),
  managed('outbox', 'Delivery queue', 'Integrations', 'admin/outbox', 'administration:read', { eventType: 'Event', attempts: 'Attempts' }),
  managed('investigations', 'Investigations', 'Incidents', 'investigations', 'investigations:read', { title: 'Title', openedBy: 'Opened by' }),
  managed('evidence', 'Evidence packages', 'Evidence', 'evidence-packages', 'evidence:read', { checksum: 'Checksum', investigationId: 'Investigation', byteLength: 'Size (bytes)' }),
  managed('exports', 'Export requests', 'Evidence', 'exports', 'exports:read', { requesterId: 'Requested by', approverId: 'Decided by', hasMore: 'More matching records' }),
  report('activity-report', 'Activity report', 'reports/activity'),
  report('security-report', 'Security report', 'reports/security'),
  report('financial-report', 'Financial report', 'reports/financial'),
  report('payroll-report', 'Payroll report', 'reports/payroll'),
  report('access-report', 'Access report', 'reports/access'),
  report('permissions-report', 'Permissions report', 'reports/permissions'),
  records('compliance', 'Compliance activity', 'Reports', { category: 'COMPLIANCE' }),
  managed('retention', 'Retention policies', 'Retention', 'admin/retention', 'retention:read', { category: 'Category', days: 'Days', version: 'Version', automatic: 'Automatic' }),
  managed('archive', 'Archive executions', 'Retention', 'admin/retention/executions', 'retention:read', { policyId: 'Policy', archived: 'Archived', held: 'Protected', cutoff: 'Cutoff' }),
  managed('holds', 'Legal holds', 'Retention', 'admin/legal-holds', 'legal-holds:read', { resourceType: 'Resource type', resourceId: 'Resource', wholeScope: 'Entire scope' }),
  managed('integrity', 'Verification runs', 'Integrity', 'admin/integrity', 'integrity:read', { assurance: 'Assurance', checked: 'Records checked', throughSequence: 'Sequence' }),
  managed('checkpoints', 'Signed checkpoints', 'Integrity', 'admin/integrity/checkpoints', 'integrity:read', { sequence: 'Sequence', recordHash: 'Hash' }),
  managed('failures', 'Ingestion failures', 'Integrity', 'admin/ingestion-failures', 'administration:read', { eventId: 'Event', attempts: 'Attempts', sourceId: 'Source', errorType: 'Error' }),
  managed('reconciliation', 'Reconciliation', 'Integrity', 'admin/reconciliation', 'administration:read', { scanned: 'Scanned', ingested: 'Ingested', duplicates: 'Duplicates', failed: 'Failed' }),
  { path: 'metrics', title: 'Operational metrics', group: 'Integrity', view: 'metrics', endpoint: 'admin/metrics', permission: auditGrant('administration:read') },
  managed('policies', 'Audit policies', 'Settings', 'admin/policies', 'policies:read', { code: 'Code', eventType: 'Event type', severity: 'Severity', sensitive: 'Sensitive', version: 'Version' }),
  managed('alert-rules', 'Alert rules', 'Settings', 'admin/alert-rules', 'alerts:read', { code: 'Code', eventType: 'Event type', threshold: 'Threshold', windowMinutes: 'Window (min)' }),
];

export function canOpenAudit(grants: readonly string[]) {
  return AUDIT_SECTIONS.some(section => grants.includes(section.permission));
}
