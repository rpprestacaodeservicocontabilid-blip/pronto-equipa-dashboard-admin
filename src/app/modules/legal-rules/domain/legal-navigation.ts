export const LEGAL_READ = 'legal-rules:read';
export const LEGAL_AUDIT = 'audit:records:read-platform';

export const LEGAL_SECTIONS = [
  { path: 'overview', title: $localize`:@@ui-thnxru:Overview`, group: 'Legal management', view: 'overview' },
  { path: 'sources', title: 'Legislation', group: 'Legal management', view: 'sources' },
  { path: 'income-tax', title: 'Income tax (IRT)', group: 'Tax and contributions', view: 'category' },
  { path: 'social-security', title: 'Social security (INSS)', group: 'Tax and contributions', view: 'category' },
  { path: 'minimum-wage', title: 'Minimum wage', group: 'Labour rules', view: 'category' },
  { path: 'working-time', title: 'Working time and overtime', group: 'Labour rules', view: 'category' },
  { path: 'night-holidays', title: 'Night work and holidays', group: 'Labour rules', view: 'category' },
  { path: 'leave-allowances', title: 'Leave and allowances', group: 'Labour rules', view: 'category' },
  { path: 'absences', title: 'Absences', group: 'Labour rules', view: 'category' },
  { path: 'termination', title: 'Termination', group: 'Labour rules', view: 'category' },
  { path: 'deductions', title: 'Salary deductions', group: 'Labour rules', view: 'category' },
  { path: 'rule-sets', title: 'Rule sets', group: 'Control and publication', view: 'versions' },
  { path: 'versions', title: 'Versions and effective dates', group: 'Control and publication', view: 'versions' },
  { path: 'approvals', title: $localize`:@@ui-1m405m7:Approvals`, group: 'Control and publication', view: 'versions' },
  { path: 'publications', title: 'Publications', group: 'Control and publication', view: 'versions' },
  { path: 'impact', title: 'Impact simulations', group: 'Analysis and compliance', view: 'analysis' },
  { path: 'comparison', title: 'Compare versions', group: 'Analysis and compliance', view: 'analysis' },
  { path: 'audit', title: 'Legal audit', group: 'Analysis and compliance', view: 'audit', permission: LEGAL_AUDIT },
  { path: 'access', title: $localize`:@@ui-x7i7sm:Access and permissions`, group: 'Administration', view: 'settings' },
  { path: 'settings', title: $localize`:@@ui-ktdb8o:Settings`, group: 'Administration', view: 'settings' },
] as const;
export type LegalSection = typeof LEGAL_SECTIONS[number];
export type LegalCategory = Extract<LegalSection, {view: 'category'}>['path'];

export function canOpenLegalSection(section: LegalSection, grants: string[]) {
  return grants.includes(LEGAL_READ) && (!('permission' in section) || grants.includes(section.permission));
}
