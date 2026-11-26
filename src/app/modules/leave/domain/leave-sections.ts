export const LEAVE_SECTIONS = [
  { path: 'overview', label: $localize`:@@ui-thnxru:Overview`, grants: ['leave.requests.read', 'leave.reports.read', 'leave.accounts.read', 'leave.planning.read'] },
  { path: 'requests', label: $localize`:@@ui-efmneb:Requests`, grants: ['leave.requests.read'] },
  { path: 'approvals', label: $localize`:@@ui-1m405m7:Approvals`, grants: ['leave.requests.read'] },
  { path: 'calendar', label: $localize`:@@ui-17xfl1b:Calendar`, grants: ['leave.requests.read', 'leave.planning.read'] },
  { path: 'balances', label: 'Balances and entitlements', grants: ['leave.accounts.read'] },
  { path: 'plans', label: 'Annual plan', grants: ['leave.requests.read'] },
  { path: 'conflicts', label: 'Overlaps and conflicts', grants: ['leave.planning.read'] },
  { path: 'history', label: $localize`:@@ui-yugfpb:History`, grants: ['leave.requests.read', 'audit:records:read-tenant'] },
  { path: 'reports', label: $localize`:@@ui-wwt148:Reports`, grants: ['leave.reports.read'] },
];
