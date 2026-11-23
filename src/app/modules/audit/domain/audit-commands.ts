import { auditCategories, auditOutcomes, auditSeverities } from './audit.models';

export interface AuditField {
  name: string;
  label: string;
  kind: 'text' | 'reason' | 'ids' | 'number' | 'choice' | 'check';
  required?: boolean;
  options?: readonly string[];
  max?: number;
  initial?: string | number | boolean;
}

export interface AuditCommand {
  title: string;
  path: string;
  grant: string;
  explanation?: string;
  fields: readonly AuditField[];
  feedback?: 'verification' | 'reconciliation';
}

const reason: AuditField = { name: 'reason', label: 'Reason', kind: 'reason', required: true, max: 2000 };
const ids: AuditField = { name: 'recordIds', label: 'Record IDs (one per line or comma-separated)', kind: 'ids', required: true };
const eventType: AuditField = { name: 'eventType', label: 'Event type (optional)', kind: 'text', max: 200 };
const code: AuditField = { name: 'code', label: 'Code', kind: 'text', required: true, max: 200 };

const policy: AuditCommand = {
  title: 'Publish policy version', path: 'admin/policies', grant: 'policies:manage',
  fields: [code, eventType, { name: 'severity', label: 'Severity', kind: 'choice', required: true, options: auditSeverities, initial: 'MEDIUM' },
    { name: 'sensitive', label: 'Classify matching events as sensitive', kind: 'check' }, reason],
};
const retention: AuditCommand = {
  title: 'Publish retention policy', path: 'admin/retention', grant: 'retention:manage',
  fields: [
    { name: 'category', label: 'Category', kind: 'choice', required: true, options: auditCategories },
    { name: 'days', label: 'Retention days', kind: 'number', required: true, max: 365000 },
    { name: 'legalReference', label: 'Legal reference', kind: 'reason', required: true, max: 2000 },
    { name: 'automatic', label: 'Allow the configured worker to run this policy automatically', kind: 'check' }, reason,
  ],
};
const alertRule: AuditCommand = {
  title: 'Create alert rule', path: 'admin/alert-rules', grant: 'alerts:manage',
  fields: [
    code, eventType, { name: 'outcome', label: 'Outcome (optional)', kind: 'choice', options: auditOutcomes },
    { name: 'severity', label: 'Severity (optional)', kind: 'choice', options: auditSeverities },
    { name: 'threshold', label: 'Number of matching events', kind: 'number', required: true, initial: 1, max: 1000 },
    { name: 'windowMinutes', label: 'Window in minutes', kind: 'number', required: true, initial: 60, max: 1440 },
  ],
};

export const AUDIT_NEW_COMMANDS: Partial<Record<string, AuditCommand>> = {
  investigations: { title: 'Open investigation', path: 'investigations', grant: 'investigations:create',
    fields: [{ name: 'title', label: 'Title', kind: 'text', required: true, max: 200 }, reason] },
  evidence: { title: 'Create evidence package', path: 'evidence-packages', grant: 'evidence:create',
    fields: [ids, { name: 'investigationId', label: 'Open investigation ID (optional)', kind: 'text', max: 36 }] },
  integrity: { title: 'Run integrity verification', path: 'admin/integrity/verify', grant: 'integrity:verify',
    explanation: 'Check the record hashes, sequence and any signed checkpoints in this scope.', fields: [], feedback: 'verification' },
  checkpoints: { title: 'Create signed checkpoint', path: 'admin/integrity/checkpoints', grant: 'integrity:verify',
    explanation: 'Sign a checkpoint for the current audit sequence.', fields: [] },
  reconciliation: { title: 'Run reconciliation', path: 'admin/reconciliation', grant: 'administration:manage',
    explanation: 'Compare the next batch of source events with the audit trail.', fields: [], feedback: 'reconciliation' },
  retention,
  holds: { title: 'Create legal hold', path: 'admin/legal-holds', grant: 'legal-holds:create',
    fields: [
      { ...ids, required: false }, { name: 'resourceType', label: 'Resource type (optional)', kind: 'text', max: 200 },
      { name: 'resourceId', label: 'Resource ID (optional)', kind: 'text', max: 200 },
      { name: 'wholeScope', label: 'Apply the hold to the entire platform scope', kind: 'check' }, reason,
    ] },
  policies: policy,
  'alert-rules': alertRule,
};

export function auditRowCommand(title: string, path: string, grant: string, fields: readonly AuditField[] = [], explanation?: string): AuditCommand {
  return { title, path, grant, fields, explanation };
}
export const auditReasons = [reason] as const;
export const auditRecordIds = [ids] as const;
