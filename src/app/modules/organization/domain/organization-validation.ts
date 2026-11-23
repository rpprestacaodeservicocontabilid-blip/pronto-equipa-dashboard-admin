import { DepartmentNode, Shift } from './organization.models';

export function validPeriod(from: string, to: string) {
  return Boolean(from) && (!to || to >= from);
}

export function validAllocation(allocations: { costCenterId: string; percentage: number | null }[]) {
  if (!allocations.length || allocations.length > 50
      || new Set(allocations.map(entry => entry.costCenterId)).size !== allocations.length) return false;
  let hundredths = 0;
  for (const entry of allocations) {
    const value = entry.percentage ?? 0;
    const rounded = Math.round(value * 100);
    if (!entry.costCenterId || rounded <= 0 || rounded > 10_000 || Math.abs(value * 100 - rounded) > 0.000001) return false;
    hundredths += rounded;
  }
  return hundredths === 10_000;
}

export function descendantIds(node: DepartmentNode): Set<string> {
  const found = new Set<string>();
  const pending = [node];
  while (pending.length) {
    const next = pending.pop()!;
    if (found.has(next.id)) continue;
    found.add(next.id);
    pending.push(...next.children);
  }
  return found;
}

const minute = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

export function shiftValidation(shift: Shift, current: Shift[]): string {
  const time = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!time.test(shift.startTime) || !time.test(shift.endTime) || !Number.isInteger(shift.weekday) || shift.weekday < 0 || shift.weekday > 6) {
    return 'Select a weekday and two valid times.';
  }
  const duration = minute(shift.endTime) + (shift.crossesMidnight ? 1440 : 0) - minute(shift.startTime);
  if (duration <= 0 || duration > 1440) return 'Enter a valid shift and mark overnight work when it ends on the next day.';
  if (!Number.isInteger(shift.breakMinutes) || shift.breakMinutes < 0 || shift.breakMinutes >= duration) {
    return 'The break must be shorter than the shift.';
  }
  const week = 7 * 1440;
  const start = shift.weekday * 1440 + minute(shift.startTime);
  const end = start + duration;
  const overlap = current.some(item => {
    const itemStart = item.weekday * 1440 + minute(item.startTime);
    const itemEnd = item.weekday * 1440 + minute(item.endTime) + (item.crossesMidnight ? 1440 : 0);
    return [-week, 0, week].some(offset => start < itemEnd + offset && itemStart + offset < end);
  });
  return overlap ? 'Shifts cannot overlap, including overnight and across the week boundary.' : '';
}

export function isoDate(date: Date) { return date.toISOString().slice(0, 10); }
