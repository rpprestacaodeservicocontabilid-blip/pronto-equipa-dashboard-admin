import { EmployeeStatus } from './employee.models';
import { employeeProfileSections, ProfileSection } from './employee-administration';

export const employeeGrants = {
  read: 'employees.read', create: 'employees.create', update: 'employees.update',
  personalRead: 'employees.personal.read', personalManage: 'employees.personal.manage',
  status: 'employees.status.manage', terminate: 'employees.terminate', rehire: 'employees.rehire',
  transfer: 'employees.transfer', bankRead: 'employees.bank_accounts.read', bankManage: 'employees.bank_accounts.manage',
  dependentRead: 'employees.dependents.read', dependentManage: 'employees.dependents.manage',
  history: 'employees.history.read', export: 'employees.export', import: 'employees.import',
} as const;
const grant = employeeGrants;

export interface EmployeeSection {
  path: string;
  title: string;
  view: 'overview' | 'directory' | 'new' | 'imports' | 'exports' | 'profile' | 'personal' | 'professional' | 'status' | 'bank' | 'dependents' | 'history' | 'documents' | 'complementary' | 'registrations' | 'reports';
  grants: readonly string[];
  status?: EmployeeStatus;
  profileSection?: ProfileSection;
}
export const EMPLOYEE_SECTIONS: readonly EmployeeSection[] = [
  { path: 'overview', title: $localize`:@@employees-overview:Overview`, view: 'overview', grants: [grant.read] },
  { path: 'all', title: $localize`:@@employees-all-employees:All employees`, view: 'directory', grants: [grant.read] },
  { path: 'active', title: $localize`:@@employees-active-employees:Active employees`, view: 'directory', grants: [grant.read], status: 'ACTIVE' },
  { path: 'suspended', title: $localize`:@@employees-suspended-employees:Suspended employees`, view: 'directory', grants: [grant.read], status: 'SUSPENDED' },
  { path: 'on-leave', title: $localize`:@@employees-employees-on-leave:Employees on leave`, view: 'directory', grants: [grant.read], status: 'ON_LEAVE' },
  { path: 'admissions', title: $localize`:@@employees-admissions:Admissions`, view: 'directory', grants: [grant.read] },
  { path: 'departures', title: $localize`:@@employees-departures:Departures`, view: 'directory', grants: [grant.read], status: 'TERMINATED' },
  { path: 'new', title: $localize`:@@employees-new-employee:New employee`, view: 'new', grants: [grant.create, grant.personalManage] },
  { path: 'registrations', title: $localize`:@@employees-registration-review:Registration review`, view: 'registrations', grants: [grant.read, grant.personalRead] },
  { path: 'imports', title: $localize`:@@employees-import-employees:Import employees`, view: 'imports', grants: [grant.import, grant.personalManage] },
  { path: 'exports', title: $localize`:@@employees-export-employees:Export employees`, view: 'exports', grants: [grant.export] },
  { path: 'reports', title: $localize`:@@employees-workforce-reports:Workforce reports`, view: 'reports', grants: [grant.read] },
];
export const EMPLOYEE_PROFILE: readonly EmployeeSection[] = [
  { path: '', title: $localize`:@@employees-profile:Profile`, view: 'profile', grants: [grant.read] },
  { path: 'personal', title: $localize`:@@employees-personal-data:Personal data`, view: 'personal', grants: [grant.read, grant.personalRead] },
  ...Object.entries(employeeProfileSections).map(([key, section]): EmployeeSection => ({
    path: key, title: section.title, view: 'complementary', profileSection: key as ProfileSection, grants: [grant.read, section.read],
  })),
  { path: 'professional', title: $localize`:@@employees-professional-data:Professional data`, view: 'professional', grants: [grant.read] },
  { path: 'status', title: $localize`:@@employees-employment-status:Employment status`, view: 'status', grants: [grant.read] },
  { path: 'bank', title: $localize`:@@employees-bank-account:Bank account`, view: 'bank', grants: [grant.read, grant.bankRead] },
  { path: 'dependents', title: $localize`:@@employees-dependents:Dependents`, view: 'dependents', grants: [grant.read, grant.dependentRead] },
  { path: 'documents', title: $localize`:@@employees-documents:Documents`, view: 'documents', grants: [grant.read, 'documents:read', 'documents:read-sensitive'] },
  { path: 'history', title: $localize`:@@employees-history:History`, view: 'history', grants: [grant.read, grant.history] },
];
export function hasEmployeeGrants(permissions: readonly string[], grants: readonly string[]) {
  return grants.every(grant => permissions.includes(grant));
}
