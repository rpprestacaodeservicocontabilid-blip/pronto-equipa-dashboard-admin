import { ACTIONS, EmployeeReference, LeaveAction, LeaveRequest, LeaveStatus, Segment } from './leave.models';

export function dateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Africa/Luanda', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  return ['year', 'month', 'day'].map(key => parts.find(part => part.type === key)?.value).join('-');
}

export function dateAt(value: string) { return new Date(value + 'T00:00:00Z'); }
export function isoDate(date: Date) { return date.toISOString().slice(0, 10); }
export function addDays(value: string, days: number) {
  const date = dateAt(value);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
}

export function validRange(start: string, end: string) {
  const date = (value: string) => {
    const parsed = dateAt(value);
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(+parsed) && isoDate(parsed) === value;
  };
  return date(start) && date(end) && start <= end;
}

export function overlap(a: Segment, b: Segment) {
  return a.startDate <= b.endDate && b.startDate <= a.endDate;
}

export function checkedSegments(segments: Segment[]) {
  const ordered = segments.map(({ startDate, endDate }) => ({ startDate, endDate }))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  if (!ordered.length || ordered.length > 20 || ordered.some(period => !validRange(period.startDate, period.endDate))) {
    throw new Error('Enter between 1 and 20 valid leave periods.');
  }
  if (ordered.some((period, index) => index > 0 && overlap(period, ordered[index - 1]))) {
    throw new Error('Periods in the same request cannot overlap.');
  }
  return ordered;
}

export function availableActions(request: LeaveRequest, grants: string[], actorId: number) {
  return (Object.keys(ACTIONS) as LeaveAction[]).filter(action => {
    const rule = ACTIONS[action];
    const decision = action === 'approve' || action === 'reject' || action === 'return';
    return (rule.states as readonly LeaveStatus[]).includes(request.status)
      && grants.includes('leave.requests.' + rule.permission)
      && (!decision || request.createdByUserId !== actorId);
  });
}

export function employeeLabel(employee: EmployeeReference | undefined, id: string) {
  return employee ? employee.firstName + ' ' + employee.lastName : 'Employee · ' + id.slice(0, 8);
}
