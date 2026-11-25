export const statuses = ['ACTIVE', 'TRIALING', 'PENDING_PAYMENT', 'GRACE_PERIOD', 'SUSPENDED', 'CANCELLED', 'EXPIRED'];
export const metrics = ['ACTIVE_EMPLOYEES', 'ACTIVE_USERS', 'STORAGE_BYTES', 'PAYROLL_EMPLOYEES_PER_PERIOD', 'DOCUMENT_UPLOAD_BYTES',
  'REPORT_EXPORTS', 'SIMULATION_RUNS', 'API_REQUESTS', 'COMPANIES', 'ORGANIZATIONAL_UNITS'];
export const intervals = ['MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL'];
export const planTypes = ['FREE', 'TRIAL', 'STANDARD', 'PROFESSIONAL', 'ENTERPRISE', 'CUSTOM'];
export const label = (value: string) => value.toLowerCase().replaceAll('_', ' ').replace(/^./, first => first.toUpperCase());

export interface Row {
  id: string;
  status: string;
  companyId: number | null;
  createdAt: string;
  [key: string]: unknown;
}
export interface Page { items: Row[]; total: number; page: number; limit: number }
export interface Price { currency: string; interval: string; amount: string; customDays?: number }
export interface Limit { value: string | null; policy: string }
export interface PlanInput {
  code: string; name: string; description?: string; type: string;
  prices: Price[]; features: Record<string, boolean | number | string>; limits: Record<string, Limit>;
}
export type Plan = Row & PlanInput & { currentVersionId?: string; currentVersion?: PlanVersion; versions?: PlanVersion[] };
export type PlanVersion = Row & PlanInput & { version: number };
export interface Policy {
  trialDays: number; graceDays: number; renewalNoticeDays: number; allowOverage: boolean;
  trialEligibleOnce?: boolean; suspensionPolicy?: string;
}
