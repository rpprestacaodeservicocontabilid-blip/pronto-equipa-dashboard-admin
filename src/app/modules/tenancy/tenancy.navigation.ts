import { CompanyStatus } from './companies.service';

export const TENANCY_SECTIONS: readonly {
  path: string;
  title: string;
  group: string;
  status?: CompanyStatus;
}[] = [
  { path: 'overview', title: $localize`:@@ui-thnxru:Overview`, group: 'Monitoring' },
  { path: '', title: $localize`:@@ui-i4yiur:All companies`, group: 'Company directory' },
  { path: 'active', title: $localize`:@@ui-1mljis0:Active companies`, group: 'Company directory', status: 'ACTIVE' },
  { path: 'suspended', title: $localize`:@@ui-134xxyp:Suspended companies`, group: 'Lifecycle', status: 'SUSPENDED' },
];
