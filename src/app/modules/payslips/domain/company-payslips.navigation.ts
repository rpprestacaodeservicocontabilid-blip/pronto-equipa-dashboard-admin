import { ReceiptStatus, ReceiptType, RECEIPT_TYPES, label } from './payslip-supervision.models';

export interface CompanyPayslipSection {
  path: string; title: string; group: string; grants: string[];
  view: 'directory' | 'issue' | 'batches' | 'templates' | 'policy' | 'summary' | 'portal' | 'link';
  type?: ReceiptType; status?: ReceiptStatus;
}
const read = ['payslips:read', 'payslips:read-sensitive'];
const directory = (path: string, title: string, group: string, filters: Partial<Pick<CompanyPayslipSection, 'type' | 'status'>> = {}): CompanyPayslipSection =>
  ({ path, title, group, grants: read, view: 'directory', ...filters });
export const companyPayslipSections: CompanyPayslipSection[] = [
  { path: 'overview', title: 'Company indicators', group: 'Operations', view: 'summary', grants: ['payslips:reports:read'] },
  directory('register', 'Payslip register', 'Operations'),
  { path: 'issue', title: 'Individual issuance', group: 'Operations', view: 'issue', grants: [...read, 'payslips:generate'] },
  { path: 'batches', title: 'Batch issuance', group: 'Operations', view: 'batches', grants: ['payslips:read'] },
  directory('publication', 'Ready for publication', 'Operations', { status: 'VALIDATED' }),
  ...RECEIPT_TYPES.map(type => directory(type.toLowerCase().replaceAll('_', '-'), label(type), 'Receipt types', { type })),
  directory('archive', 'Document archive', 'Operations', { status: 'ARCHIVED' }),
  { path: 'templates', title: 'Document templates', group: 'Configuration', view: 'templates', grants: ['payslips:read'] },
  { path: 'policies', title: 'Company policy', group: 'Configuration', view: 'policy', grants: ['payslips:policies:manage'] },
  { path: 'employee-link', title: 'Employee portal access', group: 'Configuration', view: 'link', grants: ['payslips:employees:link'] },
  { path: 'my-payslips', title: 'My published payslips', group: 'Employee portal', view: 'portal', grants: ['payslips:self:read'] },
];
export function hasPayslipGrants(permissions: readonly string[], ...required: string[]) {
  return required.every(grant => permissions.includes(grant));
}
