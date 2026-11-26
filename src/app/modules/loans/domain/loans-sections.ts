export const LOAN_GROUPS = ['Loans', 'Collections', 'Financial operations', 'Administration'] as const;

interface Section {
  path: string;
  title: string;
  group: typeof LOAN_GROUPS[number];
  grants: string[];
  requires?: string[];
  page: 'overview' | 'register' | 'collections' | 'policies' | 'audit';
  detail?: 'application' | 'loan';
}

export const LOAN_SECTIONS: Section[] = [
  { path: 'overview', title: $localize`:@@ui-thnxru:Overview`, group: 'Loans', page: 'overview', grants: ['reports.read', 'applications.read', 'loans.read', 'deductions.read'] },
  { path: 'applications', title: $localize`:@@ui-d6g082:Applications`, group: 'Loans', page: 'register', detail: 'application', grants: ['applications.read', 'applications.create'] },
  { path: 'approvals', title: 'Pending approvals', group: 'Loans', page: 'register', grants: ['applications.read'] },
  { path: 'active', title: 'Active loans', group: 'Loans', page: 'register', detail: 'loan', grants: ['loans.read'] },
  { path: 'advances', title: 'Salary advances', group: 'Loans', page: 'register', grants: ['applications.read', 'applications.create'] },
  { path: 'repayment-plans', title: 'Repayment plans', group: 'Collections', page: 'register', detail: 'loan', grants: ['loans.read'] },
  { path: 'installments', title: 'Installments', group: 'Collections', page: 'register', detail: 'loan', grants: ['loans.read'] },
  { path: 'deductions', title: 'Payroll deductions', group: 'Collections', page: 'collections', grants: ['deductions.read'] },
  { path: 'overdue', title: 'Overdue installments', group: 'Collections', page: 'collections', grants: ['reports.read'] },
  { path: 'disbursements', title: 'Disbursements', group: 'Financial operations', page: 'register', detail: 'loan', requires: ['loans.read'],
    grants: ['disbursements.read', 'disbursements.request'] },
  { path: 'repayments', title: 'Repayments', group: 'Financial operations', page: 'register', detail: 'loan', requires: ['loans.read'],
    grants: ['repayments.read', 'repayments.register'] },
  { path: 'renegotiations', title: 'Renegotiations', group: 'Financial operations', page: 'register', detail: 'loan',
    grants: ['renegotiations.request', 'renegotiations.decide'] },
  { path: 'settlements', title: 'Settlements', group: 'Financial operations', page: 'register', detail: 'loan', grants: ['loans.read'] },
  { path: 'policies', title: 'Lending policies', group: 'Administration', page: 'policies', grants: ['policies.read', 'policies.manage'] },
  { path: 'reports', title: $localize`:@@ui-wwt148:Reports`, group: 'Administration', page: 'collections', grants: ['reports.read'] },
  { path: 'audit', title: $localize`:@@ui-jnu6u8:Audit history`, group: 'Administration', page: 'audit', grants: ['audit:records:read-tenant'] },
];

export function hasGrant(permissions: string[], grant: string) {
  return permissions.includes(grant.startsWith('audit:') ? grant : 'loans.' + grant);
}

export function canOpen(section: Section, permissions: string[]) {
  if (section.path === 'renegotiations' && !hasGrant(permissions, 'loans.read')) return hasGrant(permissions, 'renegotiations.decide');
  return section.grants.some(grant => hasGrant(permissions, grant)) &&
    (!section.requires || section.requires.every(grant => hasGrant(permissions, grant)));
}
