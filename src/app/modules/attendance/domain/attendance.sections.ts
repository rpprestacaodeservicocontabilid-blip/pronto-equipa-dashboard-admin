import { AttendanceResource } from './attendance.models';

interface Section {
  path: string;
  title: string;
  permissions: string[];
  group: 'Attendance' | 'Operations' | 'Administration';
  resource?: AttendanceResource;
  details?: boolean;
}

export const ATTENDANCE_SECTIONS: Section[] = [
  { path: 'overview', title: 'Overview', group: 'Attendance', permissions: ['days.read', 'reports.read', 'occurrences.read', 'justifications.read', 'corrections.read', 'periods.read', 'punches.read'] },
  { path: 'records', title: 'Time records', group: 'Attendance', permissions: ['punches.read', 'punches.create'], resource: 'punches', details: true },
  { path: 'daily', title: 'Daily attendance', group: 'Attendance', permissions: ['days.read', 'days.calculate'], resource: 'days', details: true },
  { path: 'absences', title: 'Absences', group: 'Attendance', permissions: ['occurrences.read'], resource: 'occurrences', details: true },
  { path: 'deviations', title: 'Late arrivals and early departures', group: 'Attendance', permissions: ['occurrences.read'], resource: 'occurrences', details: true },
  { path: 'justifications', title: 'Justifications', group: 'Attendance', permissions: ['justifications.read', 'justifications.create'], resource: 'justifications', details: true },
  { path: 'corrections', title: 'Corrections', group: 'Attendance', permissions: ['corrections.read', 'corrections.create'], resource: 'corrections', details: true },
  { path: 'map', title: 'Attendance map', group: 'Attendance', permissions: ['days.read'], resource: 'days' },
  { path: 'imports', title: 'Imports', group: 'Operations', permissions: ['imports.create'] },
  { path: 'periods', title: 'Period close', group: 'Operations', permissions: ['periods.read', 'periods.manage'], resource: 'periods', details: true },
  { path: 'reports', title: 'Reports', group: 'Operations', permissions: ['reports.read', 'days.read', 'occurrences.read', 'justifications.read', 'corrections.read', 'periods.read'], resource: 'days' },
  { path: 'settings', title: 'Policy settings', group: 'Administration', permissions: ['policy.manage'] },
  { path: 'history', title: 'Audit history', group: 'Administration', permissions: ['audit:records:read-tenant'] },
];

export function can(permissions: string[], permission: string) {
  return permissions.includes(permission.startsWith('audit:') ? permission : 'attendance.' + permission);
}
