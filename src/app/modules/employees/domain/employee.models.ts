export const employeeStatuses = { ACTIVE: 'Active', SUSPENDED: 'Suspended', ON_LEAVE: 'On leave', TERMINATED: 'Terminated' } as const;
export type EmployeeStatus = keyof typeof employeeStatuses;
export const statusOptions = Object.keys(employeeStatuses) as EmployeeStatus[];

export interface EmployeeProfessional {
  departmentId: number | null;
  jobTitle: string | null;
  jobCategory: string | null;
}
export interface EmployeePersonal {
  dateOfBirth: string | null;
  nationality: string | null;
  email: string | null;
  phone: string | null;
}
export interface EmployeeRegistration extends EmployeeProfessional, EmployeePersonal {
  employeeNumber: string;
  firstName: string;
  lastName: string;
  admissionDate: string;
}
export interface Employee extends Omit<EmployeeRegistration, keyof EmployeePersonal> {
  id: string;
  companyId: number;
  status: EmployeeStatus;
}
export interface EmployeeFilter {
  page: number;
  limit: number;
  status?: EmployeeStatus;
  search?: string;
  admittedFrom?: string;
  admittedTo?: string;
  departmentId?: number;
  sort?: 'name' | 'admission-desc';
}
export interface BankAccount {
  bankName: string;
  accountName: string;
  accountNumber: string;
  iban: string | null;
  currency: string;
}
export interface DependentInput { fullName: string; relationship: string; dateOfBirth: string | null; fiscalDependent: boolean }
export interface Dependent extends DependentInput { id: string }
export interface EmployeeHistory {
  professional: (EmployeeProfessional & { id: number; effectiveFrom: string; effectiveTo: string | null; reason: string | null })[];
  status: { id: number; effectiveAt: string; fromStatus: EmployeeStatus | null; toStatus: EmployeeStatus; reason: string | null }[];
}
export interface ImportResult {
  total: number;
  succeeded: number;
  failed: number;
  results: { index: number; employeeNumber: string; success: boolean; employeeId?: string; error?: string }[];
}
