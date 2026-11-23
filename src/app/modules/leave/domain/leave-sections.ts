export const LEAVE_SECTIONS = [
  { path: 'overview', label: 'Overview', grants: ['leave.requests.read', 'leave.reports.read', 'leave.accounts.read', 'leave.planning.read'] },
  { path: 'requests', label: 'Requests', grants: ['leave.requests.read'] },
  { path: 'approvals', label: 'Approvals', grants: ['leave.requests.read'] },
  { path: 'calendar', label: 'Calendar', grants: ['leave.requests.read', 'leave.planning.read'] },
  { path: 'balances', label: 'Balances and entitlements', grants: ['leave.accounts.read'] },
  { path: 'plans', label: 'Annual plan', grants: ['leave.requests.read'] },
  { path: 'conflicts', label: 'Overlaps and conflicts', grants: ['leave.planning.read'] },
  { path: 'history', label: 'History', grants: ['leave.requests.read', 'audit:records:read-tenant'] },
  { path: 'reports', label: 'Reports', grants: ['leave.reports.read'] },
];
