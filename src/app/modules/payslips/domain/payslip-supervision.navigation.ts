import { ReceiptStatus, ReceiptType } from './payslip-supervision.models';

export interface PayslipSection {
  path: string;
  group: string;
  title: string;
  view: 'overview' | 'volume' | 'batches' | 'publication' | 'distribution' | 'portal' | 'integrity' | 'templates' | 'policies' | 'reports' | 'audit';
  type?: ReceiptType;
  status?: ReceiptStatus;
  failures?: boolean;
}

export const PAYSLIP_SECTIONS: PayslipSection[] = [
  { path: 'overview', group: 'Supervision', title: 'Overview', view: 'overview' },
  { path: 'issuance', group: 'Supervision', title: 'Issuance activity', view: 'volume' },
  { path: 'batches', group: 'Supervision', title: 'Batch issuance', view: 'batches' },
  { path: 'failures', group: 'Supervision', title: 'Failed batches', view: 'batches', failures: true },
  { path: 'monthly', group: 'Receipt types and archive', title: 'Monthly payslips', view: 'volume', type: 'REGULAR' },
  { path: 'off-cycle', group: 'Receipt types and archive', title: 'Off-cycle payslips', view: 'volume', type: 'OFF_CYCLE' },
  { path: 'supplementary', group: 'Receipt types and archive', title: 'Supplementary payslips', view: 'volume', type: 'SUPPLEMENTARY' },
  { path: 'retroactive', group: 'Receipt types and archive', title: 'Retroactive payslips', view: 'volume', type: 'RETROACTIVE' },
  { path: 'corrections', group: 'Receipt types and archive', title: 'Corrections', view: 'volume', type: 'CORRECTION' },
  { path: 'termination', group: 'Receipt types and archive', title: 'Termination payslips', view: 'volume', type: 'TERMINATION' },
  { path: 'copies', group: 'Receipt types and archive', title: 'Duplicate copies', view: 'volume', type: 'DUPLICATE_COPY' },
  { path: 'archive', group: 'Receipt types and archive', title: 'Archive', view: 'volume', status: 'ARCHIVED' },
  { path: 'publication', group: 'Publication and delivery', title: 'Publication', view: 'publication' },
  { path: 'distribution', group: 'Publication and delivery', title: 'Distribution', view: 'distribution' },
  { path: 'portal', group: 'Publication and delivery', title: 'Employee portal activity', view: 'portal' },
  { path: 'integrity', group: 'Governance', title: 'Document integrity', view: 'integrity' },
  { path: 'templates', group: 'Governance', title: 'Template versions', view: 'templates' },
  { path: 'policies', group: 'Governance', title: 'Company policies', view: 'policies' },
  { path: 'reports', group: 'Governance', title: 'Reports', view: 'reports' },
  { path: 'audit', group: 'Governance', title: 'Audit activity', view: 'audit' },
];
