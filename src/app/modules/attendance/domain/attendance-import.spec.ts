import { defaultMapping, importBatchKey, previewImport, readCsv } from './attendance-import';

describe('Attendance CSV import', () => {
  const employeeId = 'db42f487-c606-4926-af02-22ad9d75f984';
  const employees = [{ id: employeeId, employeeNumber: '0007', firstName: 'Ana', lastName: 'Manuel', departmentId: null }];

  it('maps employee numbers, preserves quoted references and removes duplicate instants', async () => {
    const csv = '\uFEFFemployee_id;punch_type;occurred_at;external_reference\r\n' +
      '0007;IN;2026-11-09T08:00:00+01:00;"Vendor; ""A"""\r\n' +
      employeeId + ';in;2026-11-09T07:00:00Z;other';
    const sheet = readCsv(csv);
    const preview = previewImport(sheet, defaultMapping(sheet.columns), employees);
    expect(preview.errors).toEqual([]);
    expect(preview.duplicates).toBe(1);
    expect(preview.rows[0]).toEqual(jasmine.objectContaining({
      employeeId, occurredAt: '2026-11-09T07:00:00.000Z', externalReference: 'Vendor; "A"',
    }));
    expect(await importBatchKey(preview.rows)).toBe(await importBatchKey(structuredClone(preview.rows)));
  });

  it('reports invalid dates and source keys reused for a different punch', () => {
    const sheet = readCsv('employeeId,punchType,occurredAt,idempotencyKey\n' +
      '0007,IN,2026-11-09T08:00:00+01:00,A\n' +
      '0007,OUT,2026-11-09T17:00:00+01:00,A\n' +
      '0007,IN,2026-02-29T08:00:00+01:00,B');
    const preview = previewImport(sheet, defaultMapping(sheet.columns), employees);
    expect(preview.rows.length).toBe(1);
    expect(preview.errors.map(error => error.row)).toEqual([2, 3]);
  });
});
