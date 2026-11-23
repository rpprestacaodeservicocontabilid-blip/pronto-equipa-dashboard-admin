import { TicketQuery } from './support.models';

export const SUPPORT_ACCESS = 'platform:support:access';
export const supportGrant = (code: string) => 'platform:support:' + code;

export interface SupportSection {
  path: string;
  title: string;
  group: string;
  permission: string;
  view: 'dashboard' | 'tickets' | 'directory';
  endpoint: string;
  global?: boolean;
  preset?: TicketQuery;
  columns?: ReadonlyArray<{ key: string; label: string }>;
}
const tickets = (path: string, title: string, group: string, preset?: TicketQuery): SupportSection =>
  ({ path, title, group, view: 'tickets', endpoint: 'tickets', permission: 'tickets:read-team', preset });
const directory = (path: string, title: string, group: string, endpoint: string, permission: string, columns: Record<string, string>, global = false): SupportSection =>
  ({ path, title, group, view: 'directory', endpoint, permission, global, columns: Object.entries(columns).map(([key, label]) => ({ key, label })) });
const incidents = { title: 'Title', severity: 'Severity', affectedServices: 'Affected services' };
const articles = { title: 'Title', visibility: 'Visibility', category: 'Category', version: 'Version' };
export const SUPPORT_SECTIONS: readonly SupportSection[] = [
  { path: 'overview', title: 'Support overview', group: 'Overview', permission: 'reports:read', view: 'dashboard', endpoint: 'dashboard' },
  tickets('tickets', 'All tickets', 'Tickets'),
  tickets('new', 'New tickets', 'Tickets', { status: 'OPEN' }),
  tickets('assigned', 'Assigned and in progress', 'Assignments', { queue: 'assigned' }),
  tickets('pending', 'Pending tickets', 'Tickets', { queue: 'pending' }),
  tickets('resolved', 'Resolved and closed', 'Tickets', { queue: 'resolved' }),
  tickets('inbox', 'Active conversations', 'Inbox', { queue: 'active' }),
  tickets('complaints', 'Complaints', 'Complaints', { type: 'COMPLAINT' }),
  directory('queues', 'Queues', 'Queues', 'queues', 'queues:read', { code: 'Code', name: 'Queue' }),
  directory('incidents', 'Company incidents', 'Incidents', 'incidents', 'incidents:read', incidents),
  directory('global-incidents', 'Global incidents', 'Incidents', 'incidents', 'incidents:read', incidents, true),
  directory('escalations', 'Escalations', 'Escalations', 'escalations', 'escalations:manage', { ticketId: 'Ticket', level: 'Level', reason: 'Reason' }),
  directory('sla-policies', 'SLA policy versions', 'SLA', 'sla/policies', 'sla:read', { code: 'Code', version: 'Version', firstResponseHours: 'Response hours', resolutionHours: 'Resolution hours' }),
  { path: 'sla-risk', title: 'At risk', group: 'SLA', permission: 'sla:read', view: 'tickets', endpoint: 'sla/at-risk' },
  { path: 'sla-breaches', title: 'Breaches', group: 'SLA', permission: 'sla:read', view: 'tickets', endpoint: 'sla/breaches' },
  directory('teams', 'Support teams', 'Support team', 'teams', 'teams:read', { code: 'Code', name: 'Team' }),
  directory('agents', 'Agents and availability', 'Support team', 'agents', 'agents:read', { name: 'Name', agentUserId: 'User' }),
  directory('knowledge', 'Company articles', 'Knowledge base', 'knowledge/articles', 'knowledge:read', articles),
  directory('global-knowledge', 'Platform articles', 'Knowledge base', 'knowledge/articles', 'knowledge:read', articles, true),
  directory('macros', 'Quick replies', 'Quick replies', 'macros', 'macros:read', { code: 'Code', name: 'Name', content: 'Reply' }),
  directory('automations', 'Automation registry', 'Automations', 'automations', 'automations:read', { code: 'Code', name: 'Name', description: 'Description' }),
  directory('ratings', 'Ratings and comments', 'Ratings', 'ratings', 'surveys:read', { ticketId: 'Ticket', rating: 'Rating', comment: 'Comment' }),
  { path: 'reports', title: 'Operational reports', group: 'Reports', permission: 'reports:read', view: 'dashboard', endpoint: 'reports' },
  directory('audit', 'Ticket history', 'Audit', 'audit', 'audit:read', { action: 'Action', ticketId: 'Ticket', actorId: 'Actor' }),
  directory('categories', 'Categories', 'Settings', 'categories', 'queues:read', { code: 'Code', name: 'Category', description: 'Description' }),
];
