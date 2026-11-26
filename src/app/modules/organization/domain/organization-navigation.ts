interface NavigationGroup {
  key: string;
  title: string;
  items: { path: string; label: string; permission?: string }[];
}

export const ORGANIZATION_NAVIGATION: NavigationGroup[] = [
  { key: '', title: '', items: [{ path: 'overview', label: $localize`:@@organization-overview:Overview` }] },
  { key: 'Company structure', title: $localize`:@@organization-company-structure:Company structure`, items: [
    { path: 'structure', label: $localize`:@@organization-hierarchy:Hierarchy` }, { path: 'departments', label: $localize`:@@organization-departments:Departments` },
    { path: 'job-functions', label: $localize`:@@organization-job-functions:Job functions` }, { path: 'job-positions', label: $localize`:@@organization-job-positions:Job positions` },
    { path: 'professional-categories', label: $localize`:@@organization-professional-categories:Professional categories` }, { path: 'establishments', label: $localize`:@@organization-establishments:Establishments` },
  ] },
  { key: 'Cost management', title: $localize`:@@organization-cost-management:Cost management`, items: [
    { path: 'cost-centers', label: $localize`:@@organization-cost-centers:Cost centers` }, { path: 'cost-allocations', label: $localize`:@@organization-cost-allocations:Cost allocations` },
  ] },
  { key: 'Time management', title: $localize`:@@organization-time-management:Time management`, items: [
    { path: 'calendars', label: $localize`:@@organization-work-calendars:Work calendars` }, { path: 'schedules', label: $localize`:@@organization-work-schedules:Work schedules` }, { path: 'shifts', label: $localize`:@@organization-shifts:Shifts` },
  ] },
  { key: 'Oversight', title: $localize`:@@organization-oversight:Oversight`, items: [
    { path: 'history', label: $localize`:@@organization-change-history:Change history`, permission: 'organization:history:read' },
    { path: 'audit', label: $localize`:@@organization-audit:Audit`, permission: 'audit:records:read-tenant' },
  ] },
];
