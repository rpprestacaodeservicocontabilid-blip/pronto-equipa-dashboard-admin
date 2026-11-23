import { Shift } from './organization.models';
import { shiftValidation, validAllocation } from './organization-validation';

describe('Organization form validation', () => {
  it('accepts exact hundredths and rejects duplicate cost centers and incomplete allocations', () => {
    expect(validAllocation([
      { costCenterId: 'A', percentage: 33.33 }, { costCenterId: 'B', percentage: 66.67 },
    ])).toBeTrue();
    expect(validAllocation([
      { costCenterId: 'A', percentage: 70 }, { costCenterId: 'A', percentage: 30 },
    ])).toBeFalse();
    expect(validAllocation([{ costCenterId: 'A', percentage: 99.99 }])).toBeFalse();
    expect(validAllocation([{ costCenterId: 'A', percentage: 99.999 }])).toBeFalse();
  });

  it('rejects overlap from Saturday into Sunday while allowing an adjacent shift', () => {
    const saturday: Shift = { weekday: 6, startTime: '22:00', endTime: '02:00', crossesMidnight: true, breakMinutes: 20 };
    const sunday: Shift = { weekday: 0, startTime: '01:30', endTime: '04:00', crossesMidnight: false, breakMinutes: 0 };
    expect(shiftValidation(sunday, [saturday])).toContain('overlap');
    expect(shiftValidation({ ...sunday, startTime: '02:00' }, [saturday])).toBe('');
    expect(shiftValidation({ ...saturday, crossesMidnight: false }, [])).toContain('overnight');
  });
});
