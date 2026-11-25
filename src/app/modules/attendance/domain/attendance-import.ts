import type { ImportSheet } from '../../../shared/utils/read-csv';
import { UUID, validDate } from './attendance-format';
import { Employee, PUNCH_TYPES, PunchInput, PunchType } from './attendance.models';

export { readCsv } from '../../../shared/utils/read-csv';
export type { ImportSheet } from '../../../shared/utils/read-csv';

export const IMPORT_FIELDS = [
  { key: 'employeeId', title: 'Employee UUID or employee number', required: true },
  { key: 'punchType', title: 'Punch type', required: true },
  { key: 'occurredAt', title: 'Timestamp with time zone', required: true },
  { key: 'workDate', title: 'Work date', required: false },
  { key: 'deviceId', title: 'Device ID', required: false },
  { key: 'externalReference', title: 'External reference', required: false },
  { key: 'idempotencyKey', title: 'Source record key', required: false },
] as const;

type Field = (typeof IMPORT_FIELDS)[number]['key'];
export type ImportMapping = Record<Field, number>;

export type ImportPreview = { rows: PunchInput[]; errors: { row: number; message: string }[]; duplicates: number };

export function defaultMapping(columns: string[]): ImportMapping {
  const normalized = columns.map(column => column.toLowerCase().replace(/[^a-z0-9]/g, ''));
  return Object.fromEntries(IMPORT_FIELDS.map(({ key }) => [key, normalized.indexOf(key.toLowerCase())])) as ImportMapping;
}

export function previewImport(sheet: ImportSheet, mapping: ImportMapping, employees: Employee[]): ImportPreview {
  const mapped = IMPORT_FIELDS.filter(field => mapping[field.key] >= 0).map(field => mapping[field.key]);
  if (IMPORT_FIELDS.some(field => field.required && mapping[field.key] < 0) || new Set(mapped).size !== mapped.length) {
    throw new Error('Map each required field to a different CSV column.');
  }
  const numbers = new Map<string, string | null>();
  for (const employee of employees) {
    if (!employee.employeeNumber) continue;
    numbers.set(employee.employeeNumber, numbers.has(employee.employeeNumber) ? null : employee.id);
  }
  const result: ImportPreview = { rows: [], errors: [], duplicates: 0 };
  const seen = new Set<string>();
  const keys = new Set<string>();
  sheet.rows.forEach((row, index) => {
    const value = (field: Field) => row[mapping[field]] || '';
    const employee = value('employeeId');
    const employeeId = UUID.test(employee) ? employee.toLowerCase() : numbers.get(employee);
    const type = value('punchType').toUpperCase();
    const occurredAt = value('occurredAt');
    const workDate = value('workDate');
    const idempotencyKey = value('idempotencyKey');
    const externalReference = value('externalReference');
    const deviceId = value('deviceId');
    const time = new Date(occurredAt);
    const hasOffset = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(occurredAt);
    const validations = [
      [row.length !== sheet.columns.length, 'Column count does not match the header.'],
      [!employeeId, 'Unknown or ambiguous employee identifier.'],
      [!Object.hasOwn(PUNCH_TYPES, type), 'Use IN, OUT, BREAK_START or BREAK_END.'],
      [!hasOffset || !validDate(occurredAt.slice(0, 10)) || !Number.isFinite(time.getTime()), 'Use an ISO timestamp with an explicit time zone.'],
      [!!workDate && !validDate(workDate), 'Work date must be a valid YYYY-MM-DD date.'],
      [[idempotencyKey, externalReference, deviceId].some(field => field.length > 200), 'Reference values must be at most 200 characters.'],
    ] as const;
    const invalid = validations.find(([fails]) => fails);
    if (invalid || !employeeId) {
      result.errors.push({ row: index + 1, message: invalid?.[1] ?? 'Invalid employee identifier.' });
      return;
    }
    const instant = time.toISOString();
    const fingerprint = JSON.stringify([employeeId, type, instant, workDate]);
    if (seen.has(fingerprint)) { result.duplicates++; return; }
    if (idempotencyKey && keys.has(idempotencyKey)) {
      result.errors.push({ row: index + 1, message: 'The source record key is already used for a different punch in this file.' });
      return;
    }
    seen.add(fingerprint);
    if (idempotencyKey) keys.add(idempotencyKey);
    result.rows.push({ employeeId, punchType: type as PunchType, occurredAt: instant, workDate: workDate || undefined,
      idempotencyKey: idempotencyKey || undefined, externalReference: externalReference || undefined, deviceId: deviceId || undefined });
  });
  return result;
}

export async function importBatchKey(rows: PunchInput[]) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(rows)));
  return 'csv-' + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
