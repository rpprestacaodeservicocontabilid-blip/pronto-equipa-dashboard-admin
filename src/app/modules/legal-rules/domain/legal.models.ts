export const LEGAL_STATUSES = ['DRAFT', 'IN_REVIEW', 'APPROVED', 'PUBLISHED', 'RETIRED', 'REJECTED'] as const;
export type LegalStatus = typeof LEGAL_STATUSES[number];
export type LegalAction = 'submit' | 'approve' | 'reject' | 'publish' | 'retire';
export const LEGAL_GRANTS = ['read', 'create', 'update', 'submit', 'approve', 'publish', 'retire'] as const;
export type LegalGrant = typeof LEGAL_GRANTS[number];

export interface Bracket { from: string; to?: string | null; rate: string; deduction?: string }
interface Incidence { includedComponentCodes?: string[]; excludedComponentCodes?: string[] }
export interface LegalDefinition {
  roundingPolicy: { mode: 'HALF_UP' | 'HALF_EVEN' | 'DOWN' | 'UP'; scale: 2 };
  laborRules: {
    prorationBasis: 'CALENDAR_DAYS' | 'FIXED_PERIOD_DAYS';
    fixedPeriodDays?: number;
    overtimeMultipliers?: Record<string, string>;
    nightWorkMultipliers?: Record<string, string>;
    maximumDailyOvertimeHours?: string;
  };
  socialSecurityRules: Incidence & { employeeRate: string; employerRate: string; minimumBase?: string; maximumBase?: string };
  incomeTaxRules: Incidence & {
    calculation: 'PROGRESSIVE' | 'MARGINAL'; brackets: Bracket[];
    exemptionAmount?: string; socialSecurityDeductible?: boolean;
  };
  deductionRules: { maxPercentageOfGross?: string; protectedNetAmount?: string; allowPartial?: boolean; allowedCategories?: string[] };
  compatibility?: { engineVersions: string[] };
}
export interface Governance {
  sourceIds?: string[];
  minimumWage?: { amount: string; sector: string; regime: string };
  holidays?: { conditions: string; multiplier?: string };
  leave?: { annualDays: number; acquisition: string; allowanceBasis: string };
  absences?: { classification: string; payTreatment: string };
  termination?: { conditions: string; compensationBasis: string };
}
export interface LegalInput {
  companyId: number | null;
  ruleSetId: string;
  version: string;
  jurisdiction: 'AO';
  effectiveFrom: string;
  effectiveTo: string | null;
  sourceReference: string;
  evidenceReference: string;
  rules: LegalDefinition;
  governance?: Governance | null;
}
export interface LegalVersion extends LegalInput {
  id: string;
  status: LegalStatus;
  integrityHash: string | null;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  submittedBy?: number | null;
  submittedAt?: string | null;
  approvedBy?: number | null;
  approvedAt?: string | null;
  publishedBy?: number | null;
  publishedAt?: string | null;
  retiredBy?: number | null;
  retiredAt?: string | null;
  rejectedBy?: number | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
}
export type LegalPatch = Omit<LegalInput, 'companyId' | 'ruleSetId' | 'version' | 'jurisdiction'> & { expectedUpdatedAt?: string };
export interface LegalPage<T> { items: T[]; page: number; limit: number; total: number }
export const SOURCE_TYPES = ['LAW', 'DECREE', 'EXECUTIVE_DECREE', 'REGULATION', 'OTHER'] as const;
export interface SourceInput {
  type: typeof SOURCE_TYPES[number];
  reference: string;
  title: string;
  issuer: string;
  publishedOn: string;
  effectiveFrom?: string;
  officialUrl: string;
  documentUrl?: string;
  articles?: string;
  notes?: string;
  relation?: 'AMENDS' | 'REPEALS';
  relatedReference?: string;
}
export interface LegalSource extends SourceInput { id: string; createdAt: string; createdBy: number }
export interface AuditRecord {
  id: string;
  action: string;
  actorId: string | number | null;
  resourceId: string | null;
  resourceType?: string;
  occurredAt: string;
  outcome: string;
}
export interface AuditPage { data: AuditRecord[]; nextCursor: number | null; throughSequence?: number }
export interface ImpactInput { baselineId: string; proposalId: string; baselineMonth: string; proposalMonth: string; salaries: string[] }
export const IMPACT_METRICS = ['incomeTax', 'employeeSocialSecurity', 'employerSocialSecurity', 'netAmount', 'totalEmployerCost'] as const;
export type ImpactMetric = typeof IMPACT_METRICS[number];
export type ImpactTotals = Record<ImpactMetric, string>;
export interface ImpactResult {
  engineVersion: string;
  currency: 'AOA';
  rows: { salary: string; baseline: ImpactTotals; proposal: ImpactTotals; difference: ImpactTotals }[];
}
