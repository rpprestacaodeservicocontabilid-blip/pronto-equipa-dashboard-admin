import { LeaveRequest } from './leave.models';
import { availableActions, checkedSegments, dateKey } from './leave-rules';

describe('Leave rules', () => {
  it('sorts segments and rejects overlapping or impossible dates', () => {
    const first = { startDate: '2026-11-02', endDate: '2026-11-04' };
    const second = { startDate: '2026-11-05', endDate: '2026-11-06' };
    expect(checkedSegments([second, first])).toEqual([first, second]);
    expect(() => checkedSegments([first, { ...second, startDate: first.endDate }])).toThrowError(/overlap/);
    expect(() => checkedSegments([{ startDate: '2026-02-30', endDate: '2026-03-02' }])).toThrowError(/valid/);
  });

  it('offers approval only in the right state to a permitted actor who did not create the request', () => {
    const request = { status: 'PENDING_APPROVAL', createdByUserId: 4 } as LeaveRequest;
    const grants = ['leave.requests.approve', 'leave.requests.submit'];
    expect(availableActions(request, grants, 4)).toEqual([]);
    expect(availableActions(request, grants, 5)).toEqual(['approve']);
    expect(availableActions({ ...request, status: 'DRAFT' }, grants, 5)).toEqual(['submit']);
  });

  it('uses the Angola calendar day through a UTC date boundary', () => {
    expect(dateKey(new Date('2026-11-18T23:30:00Z'))).toBe('2026-11-19');
  });
});
