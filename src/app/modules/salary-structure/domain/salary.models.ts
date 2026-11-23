export const COMPONENT_TYPES = ['BASE_SALARY', 'ALLOWANCE', 'BONUS', 'COMMISSION', 'BENEFIT', 'COMPLEMENT', 'ONE_TIME'];
export const CALCULATION_METHODS = ['FIXED_AMOUNT', 'PERCENTAGE', 'VARIABLE_INPUT', 'FORMULA', 'CONDITIONAL', 'ONE_TIME'];
export const FREQUENCIES = ['MONTHLY', 'WEEKLY', 'BIWEEKLY', 'ANNUAL', 'ONE_TIME'];
export const CATALOGS = ['components', 'tables', 'structures'] as const;
export type Catalog = typeof CATALOGS[number];
export type SalaryCollection = Catalog | 'assignments' | 'revisions';
export type Report = 'components' | 'structures' | 'revisions';
export type Decision = 'APPROVED' | 'REJECTED';
export type Config = Record<string, unknown>;
export interface Page<T> { data: T[]; total: number; page: number; limit: number }
export interface Query { status?: string; code?: string; employeeId?: string; from?: string; to?: string }
export interface RecordBase { id: string; status: string; createdBy: number; createdAt: string }
export interface CatalogRecord extends RecordBase { code: string; name: string; version: number; description?: string | null }
export interface Version extends RecordBase { version: number; effectiveFrom: string; effectiveTo: string | null; approvedBy?: number | null; publishedAt?: string | null }
export interface ComponentVersion extends Version {
  componentId: string;
  componentType: string;
  calculationMethod: string;
  frequency: string;
  currency: string;
  legalClassificationRef: string | null;
  calculationConfig: Config;
}
export interface Grade {
  id: string;
  tableVersionId: string;
  code: string;
  name: string;
  minAmount: string;
  maxAmount: string;
  currency: string;
  functionCode: string | null;
  categoryCode: string | null;
}
export interface Step { id: string; gradeId: string; code: string; name: string; amount: string; currency: string }
export interface Override {
  componentVersionId: string;
  amount?: string | null;
  sourceReference?: string | null;
  calculationConfig: Config;
}
export interface StructureInput extends Omit<Override, 'sourceReference'> { percentage?: string | null; required: boolean }
export interface StructureItem extends StructureInput { id: string; structureVersionId: string }
export interface CatalogDetail extends CatalogRecord { versions: Version[] }
export interface ComponentDetail extends CatalogDetail { versions: ComponentVersion[] }
export interface TableDetail extends CatalogDetail { grades: Grade[]; steps: Step[] }
export interface StructureDetail extends CatalogDetail { items: StructureItem[] }
export interface PayInput { baseSalary: string; currency: string; structureVersionId: string; components: Override[] }
export interface Assignment extends Omit<PayInput, 'structureVersionId' | 'components'>, RecordBase {
  employeeId: string;
  contractId: string;
  structureVersionId: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  version: number;
  sourceRevisionId: string | null;
  components?: AssignedComponent[];
}
export interface AssignedComponent extends Override { id: string; assignmentId: string }
export interface Revision {
  id: string;
  employeeId: string;
  previousAssignmentId: string;
  previousAssignment?: Assignment;
  effectiveFrom: string;
  status: string;
  reason: string;
  requestedBy: number;
  decidedBy: number | null;
  decidedAt: string | null;
  appliedAssignmentId: string | null;
  proposedData: PayInput & { decisionReason?: string };
  impact?: { snapshotsToReview: number };
  createdAt: string;
}
export interface BatchItem { id: string; employeeId: string; status: string; error: string | null; assignmentId: string | null; proposedData: PayInput }
export interface Batch { id: string; code: string; effectiveFrom: string; reason: string; requestedBy: number; approvedBy: number | null; status: string; items: BatchItem[] }
export interface Policy { id: string; code: string; version: number; effectiveFrom: string; effectiveTo: string | null; active: boolean; rules: Config }
export interface ResolvedComponent {
  code: string; name?: string; componentVersionId?: string; currency?: string; frequency?: string; amount: string; legalClassificationRef?: string | null;
}
export interface EffectiveSalary { assignment: Assignment; effectiveDate: string; components: ResolvedComponent[] }
export interface Snapshot { id: string; effectiveDate: string; assignmentId: string; sourceVersions: Config; resolvedComponents: ResolvedComponent[] }
export interface Simulation {
  baseSalary: string; currency: string; components: ResolvedComponent[]; totalRecurring: string;
  effectiveDate: string; legalTaxContributionsCalculated: boolean;
}
export interface AuditEvent { id: string; action: string; actorId: string | null; resourceId: string | null; occurredAt: string; outcome: string }
