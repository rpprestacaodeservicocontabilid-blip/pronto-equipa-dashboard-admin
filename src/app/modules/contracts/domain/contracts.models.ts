import type { CompanyWorkspace } from '../../../core/api/company-workspace-api';

export const CONTRACT_STATUSES = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending approval',
  APPROVED: 'Approved',
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
  EXPIRED: 'Expired',
  TERMINATED: 'Terminated',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
} as const;

export type ContractStatus = keyof typeof CONTRACT_STATUSES;
export const CLOSED_STATUSES: readonly ContractStatus[] = ['EXPIRED', 'TERMINATED', 'REJECTED', 'CANCELLED'];

export const CONTRACT_VIEWS = {
  dashboard: 'Overview',
  all: 'All contracts',
  approvals: 'Approvals',
  renewals: 'Renewals',
  amendments: 'Amendments',
  expiring: 'Expiring',
  suspensions: 'Suspensions',
  terminations: 'Terminations',
  archive: 'Archive',
  types: 'Contract types',
} as const;
export type ContractView = keyof typeof CONTRACT_VIEWS;

export interface CompanyContext extends CompanyWorkspace {
  readOnlyFallback?: boolean;
}

export interface ContractTerms extends Record<string, unknown> {
  hiringRegime?: string;
  probationDays?: string;
  payFrequency?: string;
  allowances?: string;
  paymentTerms?: string;
  workingHours?: string;
  schedule?: string;
  workplace?: string;
  department?: string;
  jobTitle?: string;
  notes?: string;
}

export interface DraftFields {
  typeCode: string;
  startDate: string;
  endDate: string | null;
  currency: string;
  salaryAmount: string | null;
  terms: ContractTerms;
}

export interface CreateContract extends DraftFields {
  employeeId: string;
  contractNumber: string;
}

export interface EmploymentContract extends CreateContract {
  id: string;
  companyId: number;
  status: ContractStatus;
  legalRuleVersionId: string | null;
  version: number;
}

export interface ContractType {
  id: number;
  companyId: number | null;
  code: string;
  name: string;
  requiresEndDate: boolean;
  maxRenewals: number | null;
  legalRuleVersionId: string | null;
  active: boolean;
}

export interface EmployeeSummary {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  departmentId: number | null;
}

export interface Department {
  id: string | number;
  name: string;
}

export interface ContractRecord {
  id: number;
  type: string;
  actorUserId: number | null;
  createdAt: string;
  payload: Record<string, unknown> & {
    snapshot?: EmploymentContract;
    documentId?: string;
    documentType?: string;
    reason?: string;
    reasonCode?: string;
    effectiveDate?: string;
    startDate?: string;
    endDate?: string | null;
  };
}

export interface DocumentSummary {
  id: string;
  name: string;
  status: string;
}

export interface SalaryAssignment {
  id: string;
  contractId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  baseSalary: string;
  currency: string;
  status: string;
}

export interface Page<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface ContractQuery {
  status?: ContractStatus;
  typeCode?: string;
  employeeId?: string;
}

export const CONTRACT_ACTIONS = {
  submit: { label: 'Submit for approval', grant: 'submit', states: ['DRAFT'] },
  approve: { label: 'Approve', grant: 'approve', states: ['PENDING_APPROVAL'] },
  reject: { label: 'Reject', grant: 'reject', states: ['PENDING_APPROVAL'] },
  activate: { label: 'Activate', grant: 'activate', states: ['APPROVED'] },
  renewals: { label: 'Renew', grant: 'renew', states: ['ACTIVE'] },
  amendments: { label: 'Create amendment', grant: 'amend', states: ['ACTIVE', 'SUSPENDED'] },
  suspensions: { label: 'Suspend', grant: 'suspend', states: ['ACTIVE'] },
  resume: { label: 'Resume', grant: 'resume', states: ['SUSPENDED'] },
  terminations: { label: 'Terminate', grant: 'terminate', states: ['ACTIVE', 'SUSPENDED'] },
  cancel: { label: 'Cancel contract', grant: 'update', states: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'] },
  archive: { label: 'Archive', grant: 'archive', states: ['EXPIRED', 'TERMINATED'] },
} as const satisfies Record<string, { label: string; grant: string; states: readonly ContractStatus[] }>;
export type ContractAction = keyof typeof CONTRACT_ACTIONS;
