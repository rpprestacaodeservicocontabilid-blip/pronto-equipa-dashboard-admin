import type { CompanyWorkspace } from '../../../core/api/company-workspace-api';

export const CONTRACT_STATUSES = {
  DRAFT: $localize`:@@contracts-draft:Draft`,
  PENDING_APPROVAL: $localize`:@@contracts-pending-approval:Pending approval`,
  APPROVED: $localize`:@@contracts-approved:Approved`,
  ACTIVE: $localize`:@@contracts-active:Active`,
  SUSPENDED: $localize`:@@contracts-suspended:Suspended`,
  EXPIRED: $localize`:@@contracts-expired:Expired`,
  TERMINATED: $localize`:@@contracts-terminated:Terminated`,
  REJECTED: $localize`:@@contracts-rejected:Rejected`,
  CANCELLED: $localize`:@@contracts-cancelled:Cancelled`,
} as const;

export type ContractStatus = keyof typeof CONTRACT_STATUSES;
export const CLOSED_STATUSES: readonly ContractStatus[] = ['EXPIRED', 'TERMINATED', 'REJECTED', 'CANCELLED'];

export const CONTRACT_VIEWS = {
  dashboard: $localize`:@@contracts-overview:Overview`,
  all: $localize`:@@contracts-all-contracts:All contracts`,
  approvals: $localize`:@@contracts-approvals:Approvals`,
  renewals: $localize`:@@contracts-renewals:Renewals`,
  amendments: $localize`:@@contracts-amendments:Amendments`,
  expiring: $localize`:@@contracts-expiring:Expiring`,
  suspensions: $localize`:@@contracts-suspensions:Suspensions`,
  terminations: $localize`:@@contracts-terminations:Terminations`,
  archive: $localize`:@@contracts-archive:Archive`,
  types: $localize`:@@contracts-contract-types:Contract types`,
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
  submit: { label: $localize`:@@contracts-submit-for-approval:Submit for approval`, grant: 'submit', states: ['DRAFT'] },
  approve: { label: $localize`:@@contracts-approve:Approve`, grant: 'approve', states: ['PENDING_APPROVAL'] },
  reject: { label: $localize`:@@contracts-reject:Reject`, grant: 'reject', states: ['PENDING_APPROVAL'] },
  activate: { label: $localize`:@@contracts-activate:Activate`, grant: 'activate', states: ['APPROVED'] },
  renewals: { label: $localize`:@@contracts-renew:Renew`, grant: 'renew', states: ['ACTIVE'] },
  amendments: { label: $localize`:@@contracts-create-amendment:Create amendment`, grant: 'amend', states: ['ACTIVE', 'SUSPENDED'] },
  suspensions: { label: $localize`:@@contracts-suspend:Suspend`, grant: 'suspend', states: ['ACTIVE'] },
  resume: { label: $localize`:@@contracts-resume:Resume`, grant: 'resume', states: ['SUSPENDED'] },
  terminations: { label: $localize`:@@contracts-terminate:Terminate`, grant: 'terminate', states: ['ACTIVE', 'SUSPENDED'] },
  cancel: { label: $localize`:@@contracts-cancel-contract:Cancel contract`, grant: 'update', states: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'] },
  archive: { label: $localize`:@@contracts-archive-contract:Archive contract`, grant: 'archive', states: ['EXPIRED', 'TERMINATED'] },
} as const satisfies Record<string, { label: string; grant: string; states: readonly ContractStatus[] }>;
export type ContractAction = keyof typeof CONTRACT_ACTIONS;
