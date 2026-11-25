import { Domain, domainLabels } from './company-reports.models';

export interface CompanyReportSection {
  path: string; title: string; group: string; grants: string[];
  view: 'dashboard' | 'catalog' | 'history' | 'exports' | 'custom';
  domain?: Domain;
}

const catalogue = 'reports:catalog:read';
export const companyReportSections: CompanyReportSection[] = [
  { path: 'overview', title: 'Company indicators', group: 'Reporting', view: 'dashboard',
    grants: ['reports:dashboard:read', 'reports:kpis:read'] },
  { path: 'catalog', title: 'Report catalogue', group: 'Reporting', view: 'catalog', grants: [catalogue] },
  ...(Object.keys(domainLabels) as Domain[]).map((domain): CompanyReportSection => ({
    path: domain, title: domainLabels[domain], group: 'Report domains', view: 'catalog', domain,
    grants: [catalogue, 'reports:' + domain + ':read', ...(['payroll', 'tax'].includes(domain) ? ['reports:salary:read-sensitive'] : [])],
  })),
  { path: 'history', title: 'Execution history', group: 'Saved reports', view: 'history', grants: ['reports:executions:read'] },
  { path: 'custom', title: 'Custom reports', group: 'Saved reports', view: 'custom', grants: [catalogue] },
  { path: 'exports', title: 'Export history', group: 'Saved reports', view: 'exports', grants: ['reports:exports:download'] },
];

export function hasReportGrants(permissions: readonly string[], ...grants: string[]) {
  return grants.every(grant => permissions.includes(grant));
}
