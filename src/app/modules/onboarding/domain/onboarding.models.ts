export const APPLICATION_STATUSES = [
  'DRAFT', 'IN_PROGRESS', 'PENDING_REVIEW', 'ADDITIONAL_INFO', 'APPROVED',
  'REJECTED', 'CANCELLED', 'PROVISIONING', 'FAILED', 'AWAITING_PAYMENT', 'COMPLETED',
] as const;
export const MODES = ['SELF_SERVICE', 'ADMIN_ASSISTED', 'SALES_ASSISTED', 'MIGRATION', 'ENTERPRISE', 'INVITATION'] as const;

export interface CompanyInput {
  name: string;
  taxId: string;
  email: string;
  address: string;
  phone?: string;
}

export interface Application {
  id: string;
  ownerId: number;
  assigneeId: number | null;
  companyId: number | null;
  companyName?: string;
  taxId?: string;
  mode: string;
  source?: string;
  status: string;
  version: number;
  duplicateCount: number;
  createdAt: string;
  updatedAt: string;
  recoverable: boolean;
  stalled: boolean;
}

export type ResourceKind = 'DOCUMENT' | 'INVITATION' | 'IMPORT';
export type ImportKind = 'EMPLOYEES' | 'CONTRACTS' | 'SALARIES';
export interface Resource {
  id: string;
  applicationId: string;
  companyName?: string;
  kind: ResourceKind;
  status: string;
  createdAt: string;
  updatedAt: string;
  fileName?: string;
  sizeBytes?: number;
  mimeType?: string;
  reviewedBy?: number;
  reason?: string;
  reviewedAt?: string;
  email?: string;
  expiresAt?: number;
  issuedBy?: number;
  importKind?: ImportKind;
  total?: number;
  succeeded?: number;
  errors?: { row: number; reason: string }[];
}

export interface OnboardingEvent {
  id: string;
  applicationId: string;
  createdAt: string;
  type: string;
  actor?: number;
  reason?: string;
  decision?: string;
  status?: string;
  step?: string;
  companyId?: number;
  assigneeId?: number;
}

export interface Workspace {
  application: Application;
  company?: CompanyInput;
  companyVerification?: { decision: string; actor: number; reason: string; reviewedAt: string };
  organization?: { departments: string[]; costCenters: string[] };
  payroll?: { currency: string; payDay: number; legalRuleSetId: string; effectiveFrom: string; componentCount: number };
  plan?: { planVersionId: string; interval: string; trialDays: number };
  subscriptionStatus: string | null;
  workflowVersion?: number;
  requiredDocuments: number;
  termsVersion?: string;
  termsAcceptedAt?: string;
  approvedBy?: number;
  decisionReason?: string;
  canInvite: boolean;
  canRemind: boolean;
  canClose: boolean;
  duplicates: Application[];
  registered: { id: number; name: string }[];
  resources: Resource[];
  events: OnboardingEvent[];
}

export interface Count { label: string; count: number }
export interface Overview {
  total: number;
  completed: number;
  pending: number;
  stalled: number;
  failed: number;
  awaitingPayment: number;
  cancelled: number;
  documents: number;
  importFailures: number;
  importBatches: number;
  meanDays: number | null;
  status: Count[];
  modes: Count[];
  daily: Count[];
  assignees: Count[];
  plans: { label: string; total: number; completed: number }[];
  recent: Application[];
}

export interface Page<T> { items: T[]; total: number; page: number; limit: number }
export interface OnboardingPolicy {
  version: number;
  requiredDocuments: number;
  invitationHours: number;
  inactivityDays: number;
}
export interface PolicyResponse {
  current: OnboardingPolicy;
  history: { id: string; version: number; actorId: number; reason: string; createdAt: string }[];
  administrativeRole: string;
}

export function label(value?: string | null) {
  if (!value) return '—';
  if (value === 'CLEAN') return 'Ready for review';
  if (value === 'ADDITIONAL_INFO') return 'Information requested';
  if (value === 'FAILED') return 'Provisioning failed';
  const content = value.replace(/^onboarding\./, '').replaceAll(/[_.-]/g, ' ').toLowerCase();
  return content[0]?.toUpperCase() + content.slice(1);
}
