interface NavigationGroup {
  title: string;
  items: { path: string; label: string; permission?: string }[];
}

export const ORGANIZATION_NAVIGATION: NavigationGroup[] = [
  { title: '', items: [{ path: 'overview', label: 'Overview' }] },
  { title: 'Company structure', items: [
    { path: 'structure', label: 'Hierarchy' }, { path: 'departments', label: 'Departments' },
    { path: 'job-functions', label: 'Job functions' }, { path: 'job-positions', label: 'Job positions' },
    { path: 'professional-categories', label: 'Professional categories' }, { path: 'establishments', label: 'Establishments' },
  ] },
  { title: 'Cost management', items: [
    { path: 'cost-centers', label: 'Cost centers' }, { path: 'cost-allocations', label: 'Cost allocations' },
  ] },
  { title: 'Time management', items: [
    { path: 'calendars', label: 'Work calendars' }, { path: 'schedules', label: 'Work schedules' }, { path: 'shifts', label: 'Shifts' },
  ] },
  { title: 'Oversight', items: [
    { path: 'history', label: 'Change history', permission: 'organization:history:read' },
    { path: 'audit', label: 'Audit', permission: 'audit:records:read-tenant' },
  ] },
];
