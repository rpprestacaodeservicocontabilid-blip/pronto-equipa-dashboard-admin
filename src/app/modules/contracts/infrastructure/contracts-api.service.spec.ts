import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ContractsApi } from './contracts-api.service';
import { EmploymentContract } from '../domain/contracts.models';

describe('Contracts API integration', () => {
  let api: ContractsApi;
  let http: HttpTestingController;
  const activeContract: EmploymentContract = {
    id: 'f3126967-f4f3-4ff3-88af-2bacea38bc29', companyId: 18, employeeId: 'worker',
    status: 'ACTIVE', contractNumber: 'CT-01', typeCode: 'FIXED', legalRuleVersionId: null,
    startDate: '2026-01-01', endDate: '2026-12-31', currency: 'AOA', salaryAmount: '50000.00', terms: {},
    version: 7,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(ContractsApi);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('reads companies through the membership catalogue and resolves access in the selected company', () => {
    api.companies().subscribe();
    const companies = http.expectOne('/api/v1/companies');
    expect(companies.request.headers.has('X-Company-Id')).toBeFalse();
    companies.flush({ data: [] });

    api.context(18).subscribe();
    const context = http.expectOne('/api/v1/company/context');
    expect(context.request.headers.get('X-Company-Id')).toBe('18');
    context.flush({ data: { company: { id: 18, name: 'My Company', status: 'ACTIVE' }, permissions: ['contracts.read'] } });
  });

  it('uses a scoped mutation and the current version for contract renewal', () => {
    api.act(18, activeContract, 'renewals', { newEndDate: '2027-12-31', reason: 'New term' })
      .subscribe(contract => expect(contract.version).toBe(8));
    const request = http.expectOne('/api/v1/contracts/' + activeContract.id + '/renewals');
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('X-Company-Id')).toBe('18');
    expect(request.request.body).toEqual({ expectedVersion: 7, newEndDate: '2027-12-31', reason: 'New term' });
    request.flush({ data: { ...activeContract, version: 8 } });
  });

  it('retains company and status on subsequent pages', () => {
    api.all(18, { status: 'ACTIVE' }).subscribe(rows => expect(rows.length).toBe(2));
    for (const page of [1, 2]) {
      const request = http.expectOne(candidate => candidate.url === '/api/v1/contracts'
        && candidate.params.get('page') === String(page));
      expect(request.request.headers.get('X-Company-Id')).toBe('18');
      expect(request.request.params.get('status')).toBe('ACTIVE');
      request.flush({
        data: [{ ...activeContract, contractNumber: 'CT-0' + page }],
        pagination: { page, limit: 100, total: 101, totalPages: 2 },
      });
    }
  });
});
