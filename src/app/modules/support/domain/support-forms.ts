export interface SupportField {
  key: string;
  label: string;
  kind?: 'textarea' | 'number' | 'choice' | 'list';
  required?: boolean;
  min?: number;
  max?: number;
  choices?: ReadonlyArray<{ value: string | number; label: string }>;
  initial?: string | number | null;
}
export interface SupportAction {
  title: string;
  path: string;
  grant: string;
  method?: 'POST' | 'PATCH';
  fields: readonly SupportField[];
  constants?: Record<string, unknown>;
  explanation?: string;
  idempotent?: boolean;
}

export const choices = (values: readonly string[]) => values.map(value => ({
  value, label: value.replaceAll('_', ' ').toLowerCase().replace(/^./, first => first.toUpperCase()),
}));
export const text = (key: string, label: string, min = 2, max = 200): SupportField =>
  ({ key, label, required: min > 0, min, max });
export const area = (key: string, label: string, min = 3, max = 4000): SupportField =>
  ({ ...text(key, label, min, max), kind: 'textarea' });
export const select = (key: string, label: string, values: readonly string[], initial?: string): SupportField =>
  ({ key, label, kind: 'choice', choices: choices(values), required: true, initial });

const named: readonly SupportField[] = [text('code', 'Code', 2, 80), text('name', 'Name', 2, 150), area('description', 'Description', 0, 1000)];
const article: readonly SupportField[] = [
  text('title', 'Title', 3), area('content', 'Article content', 10, 30000),
  select('visibility', 'Visibility', ['PUBLIC', 'TENANT', 'INTERNAL'], 'TENANT'), text('category', 'Category', 0, 80),
];
const agentStatuses = ['AVAILABLE', 'BUSY', 'OFFLINE'];
const number = (key: string, label: string, min: number, max: number, initial?: number): SupportField =>
  ({ key, label, kind: 'number', min, max, initial, required: true });

export const directoryCreate: Record<string, Omit<SupportAction, 'path'>> = {
  queues: { title: 'Create queue', grant: 'queues:manage', fields: named },
  teams: { title: 'Create team', grant: 'teams:manage', fields: named },
  categories: { title: 'Create category', grant: 'queues:manage', fields: named },
  agents: { title: 'Register agent', grant: 'agents:manage', fields: [
    number('userId', 'Platform user ID', 1, 2147483647), text('name', 'Name', 2, 150),
    select('status', 'Availability', agentStatuses, 'AVAILABLE'),
  ] },
  macros: { title: 'Create quick reply', grant: 'macros:manage', fields: [...named.slice(0, 2), area('content', 'Reply', 1, 12000)] },
  automations: { title: 'Register automation', grant: 'automations:manage', fields: named, explanation: 'Register the automation definition for review.' },
  incidents: { title: 'Open incident', grant: 'incidents:create', fields: [
    text('title', 'Title', 3), select('severity', 'Severity', ['MINOR', 'MODERATE', 'MAJOR', 'CRITICAL'], 'MAJOR'),
    { key: 'affectedServices', label: 'Affected services, separated by commas', kind: 'list', required: true, max: 600 },
    area('description', 'Description', 10, 12000),
  ] },
  'knowledge/articles': { title: 'Create article draft', grant: 'knowledge:create',
    fields: [text('slug', 'Slug (lower case and hyphens)', 3, 120), ...article] },
  'sla/policies': { title: 'Publish SLA policy version', grant: 'sla:manage', fields: [
    text('code', 'Policy code (uppercase)', 2, 60), number('firstResponseHours', 'First response hours', 1, 1000, 24),
    number('resolutionHours', 'Resolution hours', 1, 5000, 120), number('businessStartHour', 'Business day starts (UTC)', 0, 23, 9),
    number('businessEndHour', 'Business day ends (UTC)', 1, 24, 17),
    { key: 'holidays', label: 'Holidays, separated by commas (YYYY-MM-DD)', kind: 'list', max: 1200 },
  ] },
};

export function directoryActions(endpoint: string, row: { id: string; status: string; [key: string]: unknown }): SupportAction[] {
  const path = endpoint + '/' + encodeURIComponent(row.id);
  switch (endpoint) {
    case 'incidents': return [{ title: 'Update incident', grant: 'incidents:manage', method: 'PATCH', path,
      fields: [select('status', 'Status', ['OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED'], row.status),
        area('message', 'Update', 1), area('cause', 'Cause', 0), area('resolution', 'Resolution', 0)] }];
    case 'knowledge/articles': return [
      { title: 'Edit article', grant: 'knowledge:update', method: 'PATCH', path,
        fields: article.map(field => ({ ...field, initial: typeof row[field.key] === 'string' ? String(row[field.key]) : null })) },
      ...(row.status === 'DRAFT' ? [{ title: 'Publish article', grant: 'knowledge:publish', path: path + '/publish', fields: [],
        explanation: 'Publish this version with its configured visibility.' }] : []),
    ];
    case 'agents': return [{ title: 'Change availability', grant: 'agents:manage', method: 'PATCH', path: path + '/status',
      fields: [select('status', 'Availability', agentStatuses, row.status)] }];
    case 'escalations': return row.status === 'ACTIVE' ? [{ title: 'Complete escalation', grant: 'escalations:manage', path: path + '/complete',
      fields: [area('resolution', 'Outcome')] }] : [];
    default: return [];
  }
}
