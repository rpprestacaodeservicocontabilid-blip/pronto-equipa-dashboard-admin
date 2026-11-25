const grant = (key: string) => 'documents:' + key;
export const canDocument = (grants: readonly string[], ...keys: string[]) => keys.every(key => grants.includes(grant(key)));
const library = ['read', 'read-sensitive'];
export interface Section { path: string; title: string; group: string; permissions: readonly string[]; view: string; filters?: Record<string, string> }
export const sections: readonly Section[] = [
  { path: 'library', title: 'Document library', group: 'Library', permissions: library, view: 'library' },
  { path: 'employee-files', title: 'Employee categories', group: 'Library', permissions: library, view: 'library', filters: { scope: 'EMPLOYEE' } },
  { path: 'company-files', title: 'Company categories', group: 'Library', permissions: library, view: 'library', filters: { scope: 'COMPANY' } },
  { path: 'expiring', title: 'Expiring in 30 days', group: 'Validity', permissions: library, view: 'library', filters: { expiring: 'true' } },
  { path: 'expired', title: 'Expired documents', group: 'Validity', permissions: library, view: 'library', filters: { status: 'EXPIRED' } },
  { path: 'archived', title: 'Archived documents', group: 'Retention', permissions: library, view: 'library', filters: { status: 'ARCHIVED' } },
  { path: 'pending-review', title: 'Pending validation', group: 'Review', permissions: library, view: 'library', filters: { status: 'PENDING_VALIDATION' } },
  { path: 'reviews', title: 'Validation decisions', group: 'Review', permissions: library, view: 'reviews' },
  { path: 'quarantine', title: 'Quarantined documents', group: 'Review', permissions: library, view: 'library', filters: { status: 'QUARANTINED' } },
  { path: 'upload', title: 'Upload files', group: 'Uploads', permissions: ['upload'], view: 'upload' },
  { path: 'uploads', title: 'Upload history', group: 'Uploads', permissions: ['upload', 'read-sensitive'], view: 'uploads' },
  { path: 'batches', title: 'Import batches', group: 'Uploads', permissions: ['upload-bulk', 'read-sensitive'], view: 'batches' },
  { path: 'holds', title: 'Legal holds', group: 'Retention', permissions: ['legal-holds:create', 'read-sensitive'], view: 'holds' },
  { path: 'deletions', title: 'Deletion requests', group: 'Retention', permissions: ['deletion:approve', 'read-sensitive'], view: 'deletions' },
  { path: 'categories', title: 'Document categories', group: 'Administration', permissions: ['read'], view: 'categories' },
  { path: 'storage', title: 'Storage and quota', group: 'Administration', permissions: ['storage:read'], view: 'storage' },
  { path: 'audit', title: 'Access and download audit', group: 'Administration', permissions: ['audit:read'], view: 'audit' },
  { path: 'policies', title: 'Document policies', group: 'Administration', permissions: ['policies:manage'], view: 'policies' },
];
