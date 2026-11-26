import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { OrganizationRecord } from '../domain/organization.models';
import { OrganizationApi } from './organization-api.service';

describe('Organization API', () => {
  let api: OrganizationApi;
  let requests: HttpTestingController;
  const department: OrganizationRecord = {
    id: '1b8afc63-f031-4b0e-a0b4-f2a16bbf4dde', companyId: 17, code: 'FIN', name: 'Finance',
    status: 'ACTIVE', type: 'DEPARTMENT', version: 4, data: {},
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(OrganizationApi);
    requests = TestBed.inject(HttpTestingController);
  });

  afterEach(() => requests.verify());

  it('preserves a multilingual audit reason on the wire', () => {
    const reason = 'Revisão da estrutura — 组织审计';
    api.audit(17, reason).subscribe();
    const request = requests.expectOne(req => req.url === '/api/v1/audit/records');
    expect(request.request.headers.get('X-Company-Id')).toBe('17');
    expect(request.request.headers.get('X-Audit-Purpose')).toBe('utf8:' + encodeURIComponent(reason));
    request.flush({ data: { data: [], nextCursor: null, throughSequence: 0 } });
  });

  it('uses the dedicated hierarchy endpoint with the current record version and tenant header', () => {
    api.move(17, department, null).subscribe(row => expect(row.version).toBe(5));
    const request = requests.expectOne('/api/v1/organization/departments/' + department.id + '/parent');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.headers.get('X-Company-Id')).toBe('17');
    expect(request.request.body).toEqual({ expectedVersion: 4, parentId: null });
    request.flush({ data: { ...department, version: 5 } });
  });

  it('sends a complete cost distribution atomically without placing the tenant in the body', () => {
    const input = {
      employeeId: 'employee', effectiveFrom: '2026-12-01', effectiveTo: null,
      allocations: [{ costCenterId: 'first', percentage: 70 }, { costCenterId: 'second', percentage: 30 }],
    };
    api.allocations(17, input).subscribe();
    const request = requests.expectOne('/api/v1/organization/cost-allocations');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(input);
    expect(request.request.headers.get('X-Company-Id')).toBe('17');
    request.flush({ data: [] });
  });
});
