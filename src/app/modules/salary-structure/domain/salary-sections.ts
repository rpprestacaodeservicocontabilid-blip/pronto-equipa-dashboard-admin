export const GROUPS = ['Salary structure', 'Employee pay', 'Control'] as const;
export interface Section { path: string; title: string; group: typeof GROUPS[number]; grants: string[]; detail?: boolean }
const read = ['read'];
export const SECTIONS: Section[] = [
  { path: 'overview', title: $localize`:@@ui-thnxru:Overview`, group: 'Salary structure', grants: ['read', 'assignments:read', 'revisions:read'] },
  { path: 'components', title: 'Salary components', group: 'Salary structure', grants: [...read, 'components:create'], detail: true },
  { path: 'tables', title: 'Salary tables', group: 'Salary structure', grants: [...read, 'tables:manage'], detail: true },
  { path: 'grades', title: 'Grades and steps', group: 'Salary structure', grants: read, detail: true },
  { path: 'structures', title: 'Pay structures', group: 'Salary structure', grants: [...read, 'structures:create'], detail: true },
  { path: 'allowances', title: 'Allowances and benefits', group: 'Salary structure', grants: [...read, 'components:create'], detail: true },
  { path: 'assignments', title: 'Salary assignments', group: 'Employee pay', grants: ['assignments:read', 'assignments:manage'], detail: true },
  { path: 'revisions', title: 'Salary revisions', group: 'Employee pay', grants: ['revisions:read', 'revisions:create'], detail: true },
  { path: 'revision-batches', title: 'Bulk revisions', group: 'Employee pay', grants: ['revisions:batch'], detail: true },
  { path: 'history', title: 'Salary history', group: 'Employee pay', grants: ['history:read', 'assignments:read'] },
  { path: 'simulations', title: $localize`:@@ui-1fhsqsf:Simulations`, group: 'Employee pay', grants: ['simulations:run'] },
  { path: 'policies', title: 'Salary policies', group: 'Control', grants: [...read, 'policies:manage'] },
  { path: 'reports', title: $localize`:@@ui-wwt148:Reports`, group: 'Control', grants: ['reports:read'] },
  { path: 'settings', title: $localize`:@@ui-ktdb8o:Settings`, group: 'Control', grants: [...read, 'policies:manage'] },
  { path: 'audit', title: $localize`:@@ui-17q4nd4:Audit`, group: 'Control', grants: ['audit:records:read-tenant'] },
];
export function can(permissions: string[], grant: string) {
  return permissions.includes(grant.startsWith('audit:') ? grant : 'salary-structure:' + grant);
}
