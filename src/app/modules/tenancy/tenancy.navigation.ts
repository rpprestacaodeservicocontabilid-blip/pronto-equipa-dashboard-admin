import { CompanyStatus } from './companies.service';

export const TENANCY_SECTIONS: readonly {
  path: string;
  title: string;
  group: string;
  status?: CompanyStatus;
}[] = [
  { path: 'overview', title: 'Overview', group: 'Monitoring' },
  { path: '', title: 'All companies', group: 'Company directory' },
  { path: 'active', title: 'Active companies', group: 'Company directory', status: 'ACTIVE' },
  { path: 'suspended', title: 'Suspended companies', group: 'Lifecycle', status: 'SUSPENDED' },
];
