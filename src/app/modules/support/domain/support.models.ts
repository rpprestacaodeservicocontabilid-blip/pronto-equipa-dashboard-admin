export const priorities = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'] as const;
export const ticketStatuses = ['OPEN', 'TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'WAITING_INTERNAL',
  'WAITING_EXTERNAL', 'ESCALATED', 'RESOLVED', 'CLOSED', 'CANCELLED'] as const;
export const ticketTypes = ['TECHNICAL_SUPPORT', 'FUNCTIONAL_SUPPORT', 'INCIDENT', 'COMPLAINT', 'SERVICE_REQUEST',
  'QUESTION', 'ACCESS_REQUEST', 'SUBSCRIPTION_SUPPORT', 'BILLING_SUPPORT', 'PAYROLL_SUPPORT', 'DOCUMENT_SUPPORT',
  'SECURITY_INCIDENT', 'FEATURE_REQUEST'] as const;
export type TicketStatus = typeof ticketStatuses[number];
export type TicketPriority = typeof priorities[number];

export interface SupportCompany { id: number; name: string }
export interface SupportPage<T> { data: T[]; page: number; limit: number; total: number }
export interface SupportRow {
  id: string;
  status: string;
  kind: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}
export interface SupportSla {
  firstResponseDeadline?: string;
  firstRespondedAt?: string | null;
  firstResponseBreachedAt?: string | null;
  resolutionDeadline?: string;
  resolutionBreachedAt?: string | null;
  policyCode?: string;
  policyVersion?: number;
}
export interface SupportMessage extends SupportRow {
  authorId: number;
  visibility: 'PUBLIC' | 'INTERNAL';
  body: string;
}
export interface SupportTicket extends SupportRow {
  ticketNumber: string;
  subject: string;
  description: string;
  categoryCode: string;
  type: string;
  status: TicketStatus;
  priority: TicketPriority;
  requesterId: number;
  agentId: number | null;
  teamId: string | null;
  affectedModule: string | null;
  resolution: string | null;
  sla?: SupportSla;
  messages?: SupportMessage[];
}
export interface SupportDashboard {
  open: number;
  inProgress: number;
  resolvedToday: number;
  averageResponseMinutes: number | null;
  averageResolutionMinutes: number | null;
  breached: number;
  sampled?: boolean;
  byPriority: Record<string, number>;
  byStatus: Record<string, number>;
  satisfaction: { average: number; responses: number };
}
export interface TicketQuery { status?: string; priority?: string; type?: string; queue?: string }

export function supportLabel(value: string) {
  return value.replaceAll('_', ' ').toLowerCase().replace(/^./, first => first.toUpperCase());
}

const progress = ['TRIAGED', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'WAITING_INTERNAL', 'WAITING_EXTERNAL'];
const transitions: Partial<Record<TicketStatus, readonly TicketStatus[]>> = {
  OPEN: ['TRIAGED', 'IN_PROGRESS', 'CANCELLED'],
  TRIAGED: ['IN_PROGRESS', 'WAITING_CUSTOMER', 'WAITING_INTERNAL', 'CANCELLED'],
  ASSIGNED: ['IN_PROGRESS', 'WAITING_CUSTOMER', 'WAITING_INTERNAL', 'WAITING_EXTERNAL', 'CANCELLED'],
  IN_PROGRESS: ['WAITING_CUSTOMER', 'WAITING_INTERNAL', 'WAITING_EXTERNAL', 'RESOLVED', 'CANCELLED'],
  WAITING_CUSTOMER: ['IN_PROGRESS', 'RESOLVED', 'CANCELLED'],
  WAITING_INTERNAL: ['IN_PROGRESS', 'RESOLVED', 'CANCELLED'],
  WAITING_EXTERNAL: ['IN_PROGRESS', 'RESOLVED', 'CANCELLED'],
  ESCALATED: ['IN_PROGRESS', 'WAITING_CUSTOMER', 'WAITING_INTERNAL', 'RESOLVED', 'CANCELLED'],
  RESOLVED: ['CLOSED', 'IN_PROGRESS', 'OPEN'],
  CLOSED: ['OPEN'],
  CANCELLED: ['OPEN'],
};
export const ticketCan = (from: TicketStatus, to: TicketStatus) => transitions[from]?.includes(to) ?? false;
export const progressOptions = (from: TicketStatus) => (transitions[from] ?? []).filter(state => progress.includes(state));
