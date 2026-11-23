export const LOAN_TYPES = ['LOAN', 'SALARY_ADVANCE', 'EXTRAORDINARY_ADVANCE'] as const;
export const FREQUENCIES = ['MONTHLY', 'BIWEEKLY', 'WEEKLY'] as const;
export type LoanType = typeof LOAN_TYPES[number];
export type Frequency = typeof FREQUENCIES[number];
export type Decision = 'APPROVED' | 'REJECTED';
export const APPLICATION_STATES = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED', 'ACTIVE', 'SETTLED'] as const;
export interface LoanPage<T> { data: T[]; total: number; page: number; limit: number }
export interface LoanQuery { employeeId?: string; status?: string }

export interface Terms {
  loanType: LoanType;
  requestedAmount: string;
  currency: 'AOA';
  installmentCount: number;
  firstDueDate: string;
  frequency: Frequency;
  annualInterestBps: number;
}

export interface ApplicationInput extends Terms { employeeId: string; reason: string }
export interface Approval { id: string; approverId: number; decision: Decision; comments: string | null; decidedAt: string }
export interface Application extends ApplicationInput {
  id: string;
  status: string;
  createdBy: number;
  createdAt: string;
  version: number;
  approvals?: Approval[];
}

export interface Balance { principal: string; interest: string; total: string; currency: string }
export interface Loan {
  id: string;
  loanNumber: string;
  employeeId: string;
  applicationId: string;
  principalAmount: string;
  currency: string;
  status: string;
  disbursedAt: string | null;
  createdAt: string;
  updatedAt: string;
  balance: Balance;
}

export interface Installment {
  id: string;
  loanId: string;
  installmentNumber: number;
  dueDate: string;
  principalDue: string;
  interestDue: string;
  status: string;
  paid?: Balance;
}

export interface Plan {
  id: string;
  version: number;
  totalAmount: string;
  installmentCount: number;
  effectiveFrom: string;
  status: string;
  installments: Installment[];
}

export interface Simulation {
  totalAmount: string;
  policyVersion: number;
  installments: (Pick<Installment, 'dueDate' | 'principalDue' | 'interestDue'> & { number: number; totalDue: string })[];
}

export interface Disbursement {
  id: string;
  amount: string;
  paymentReference: string | null;
  status: string;
  confirmedAt: string | null;
  createdBy: number;
  createdAt: string;
}

export interface Repayment {
  id: string;
  amount: string;
  source: string;
  externalReference: string | null;
  status: string;
  createdBy: number | null;
  createdAt: string;
}

export interface Deduction {
  id: string;
  loanId: string;
  installmentId: string;
  payrollRunId: string | null;
  requestedAmount: string;
  confirmedAmount: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface RenegotiationInput { installmentCount: number; firstDueDate: string; frequency: Frequency; reason: string }
export interface Renegotiation extends RenegotiationInput {
  id: string;
  loanId: string;
  previousPlanId: string;
  newPlanId: string | null;
  status: string;
  requestedBy: number;
}

export interface PolicyInput {
  code: string;
  effectiveFrom: string;
  maxAmount: string;
  maxInstallments: number;
  maxActiveLoans: number;
  allowedTypes: LoanType[];
  interestAllowed: boolean;
  maxAnnualInterestBps: number;
  deductionAuthorizationRequired: boolean;
}

export interface Policy extends PolicyInput {
  id: string;
  version: number;
  effectiveTo: string | null;
  active: boolean;
}

export interface LoanSummary {
  activeLoans: number;
  outstandingPrincipal: string;
  outstandingInterest: string;
  outstandingTotal: string;
  currency: string;
}

export interface LedgerEntry {
  id: string;
  entryType: string;
  principalAmount: string;
  interestAmount: string;
  currency: string;
  occurredAt: string;
  externalReference: string | null;
  source: string;
  createdBy: number | null;
}

export interface LoanHistory { ledger: LedgerEntry[]; approvals: Approval[]; balance: Balance }
export interface Employee { id: string; employeeNumber: string; firstName: string; lastName: string; status: string }
export interface Contract { id: string; startDate: string; endDate: string | null; status: string }
export interface AuditEvent {
  id: string;
  action: string;
  resourceId: string | null;
  actorId: string | null;
  occurredAt: string;
  outcome: string;
}
