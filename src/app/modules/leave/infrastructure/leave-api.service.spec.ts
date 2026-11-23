import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LeaveRequest } from '../domain/leave.models';
import { LeaveApi } from './leave-api.service';

describe('Leave API', () => {
  let api: LeaveApi;
  let requests: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(LeaveApi);
    requests = TestBed.inject(HttpTestingController);
  });

  afterEach(() => requests.verify());

  it('keeps reservation and usage separate and sends version and idempotency on approval', () => {
    const draft = { id: 'request-1', version: 3, status: 'PENDING_APPROVAL' } as LeaveRequest;
    api.act(18, draft, 'approve', { comments: 'Approved' }, 'attempt-1').subscribe(row => expect(row.status).toBe('APPROVED'));
    const approved = requests.expectOne('/api/v1/leave/requests/request-1/approve');
    expect(approved.request.headers.get('X-Company-Id')).toBe('18');
    expect(approved.request.headers.get('Idempotency-Key')).toBe('attempt-1');
    expect(approved.request.body).toEqual({ expectedVersion: 3, comments: 'Approved' });
    approved.flush({ data: { ...draft, status: 'APPROVED', version: 4 } });

    api.act(18, { ...draft, status: 'APPROVED', version: 4 }, 'complete', { usedDays: 2 }, 'attempt-2').subscribe();
    const completed = requests.expectOne('/api/v1/leave/requests/request-1/complete');
    expect(completed.request.body).toEqual({ expectedVersion: 4, usedDays: 2 });
    expect(completed.request.headers.get('Idempotency-Key')).toBe('attempt-2');
    completed.flush({ data: { ...draft, status: 'COMPLETED', version: 5 } });
  });

  it('checks only the requested worker, range and optional request exclusion in the active company', () => {
    api.conflicts(24, 'worker-1', { startDate: '2026-11-02', endDate: '2026-11-04' }, 'request-1').subscribe();
    const request = requests.expectOne(candidate => candidate.url.endsWith('/leave/planning/conflicts'));
    expect(request.request.headers.get('X-Company-Id')).toBe('24');
    expect(request.request.params.get('employeeId')).toBe('worker-1');
    expect(request.request.params.get('excludeRequestId')).toBe('request-1');
    request.flush({ data: [] });
  });
});
