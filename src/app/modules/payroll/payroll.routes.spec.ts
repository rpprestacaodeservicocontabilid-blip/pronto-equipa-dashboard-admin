import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ResolveStart, Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { filter, firstValueFrom } from 'rxjs';
import { routes } from '../../app.routes';
import { AuthSessionStore } from '../auth/application/auth-session.store';
import { centsAmount, payrollCents, payrollMoney } from './domain/payroll-format';
import { PayrollPeriod, PayrollRun, RunStatus } from './domain/payroll.models';
import { PayrollApi } from './infrastructure/payroll-api.service';

describe('Payroll administration', () => {
  const root = '/api/v1/payroll/';
  const periodId = '53416291-5319-41d9-8e3b-a32d888efe60';
  const runId = '6dbf662c-da0f-429b-a25a-1eb29ffa10ae';
  const employeeId = '86321fd3-fde1-4bb4-a1e1-835d91623e46';
  const downloadKey = 'prontoequipas.payroll-export.5.18.' + runId;
  const period: PayrollPeriod = {
    id: periodId, startDate: '2026-11-01', endDate: '2026-11-30',
    paymentDate: '2026-11-30', status: 'OPEN', version: 2,
  };
  const run: PayrollRun = {
    id: runId, periodId, runType: 'REGULAR', executionScope: 'INDIVIDUAL',
    employeeIds: [employeeId], status: 'DRAFT', version: 1,
    originalRunId: null, reason: null, createdBy: 8, createdAt: '2026-11-02T09:30:00Z',
  };

  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    const claims = btoa(JSON.stringify({ sub: '5', sessionId: '1', roles: [], permissions: [], exp: 4102444800, type: 'access' }));
    TestBed.inject(AuthSessionStore).accept({ accessToken: 'token.' + claims + '.signature', refreshToken: 'refresh' });
  });

  afterEach(() => {
    sessionStorage.removeItem(downloadKey);
    http.verify();
  });

  async function render(harness: RouterTestingHarness) {
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  async function open(path: string, permissions: string[]) {
    const router = TestBed.inject(Router);
    const harness = await RouterTestingHarness.create();
    const resolving = firstValueFrom(router.events.pipe(filter(event => event instanceof ResolveStart)));
    const navigation = harness.navigateByUrl('/payroll/18/' + path);
    await resolving;
    const context = http.expectOne('/api/v1/company/context');
    expect(context.request.headers.get('X-Company-Id')).toBe('18');
    context.flush({ data: { company: { id: 18, name: 'Example Company', status: 'ACTIVE' }, permissions } });
    await navigation;
    await render(harness);
    return harness;
  }

  const button = (harness: RouterTestingHarness, label: string) => Array.from(harness.routeNativeElement!.querySelectorAll('button'))
    .find(candidate => candidate.textContent.trim() === label);

  function flushRunResources(status: RunStatus, version: number) {
    const request = http.expectOne(root + 'runs/' + runId + '/progress');
    expect(request.request.headers.get('X-Company-Id')).toBe('18');
    request.flush({ data: { status, version, totalItems: 1, completedItems: status === 'CLOSED' ? 1 : 0, failedItems: 0 } });
    http.match(root + 'runs/' + runId + '/summary').forEach(summary => summary.flush({ data: { employees: 0 } }));
  }

  it('keeps the selected Payroll submenu through company selection', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/payroll?section=reports');
    http.expectOne('/api/v1/companies').flush({ data: [{ id: 18, name: 'Example Company', status: 'ACTIVE' }] });
    await render(harness);
    const sidebar = harness.routeNativeElement!.querySelector('#sidebar-module-payroll')!;
    expect(sidebar.querySelector('button[aria-label="Reorder Reports"]')).not.toBeNull();
    expect(harness.routeNativeElement!.querySelector('a[href="/payroll/18/reports"]')?.textContent).toContain('Example Company');
  });

  it('blocks direct worksheet access without company permission for sensitive results', async () => {
    const harness = await open('worksheets/' + runId, ['payroll:read', 'payroll:results:read']);
    expect(harness.routeNativeElement?.textContent).toContain('Your company role does not allow access');
    http.expectNone(request => request.url.startsWith(root));
  });

  it('creates a scoped individual run and reuses the key after a transport failure', async () => {
    const harness = await open('individual/new?period=' + periodId, ['payroll:read', 'payroll:runs:create']);
    const list = http.expectOne(request => request.url === root + 'periods');
    list.flush({ data: { data: [period], total: 1, page: 1, limit: 100 } });
    await render(harness);
    const ids = harness.routeNativeElement!.querySelector<HTMLTextAreaElement>('textarea[name="employeeIds"]')!;
    ids.value = employeeId;
    ids.dispatchEvent(new Event('input', { bubbles: true }));
    await render(harness);
    button(harness, 'Add IDs')!.click();
    await render(harness);
    button(harness, 'Create payroll run')!.click();
    const first = http.expectOne(root + 'runs');
    expect(first.request.method).toBe('POST');
    expect(first.request.headers.get('X-Company-Id')).toBe('18');
    expect(first.request.body).toEqual({
      periodId, runType: 'REGULAR', executionScope: 'INDIVIDUAL', employeeIds: [employeeId],
      idempotencyKey: jasmine.any(String),
    });
    first.error(new ProgressEvent('error'));
    await render(harness);
    button(harness, 'Create payroll run')!.click();
    const second = http.expectOne(root + 'runs');
    expect(second.request.body.idempotencyKey).toBe(first.request.body.idempotencyKey);
    second.error(new ProgressEvent('error'));
  });

  it('makes run closing and payment preparation distinct, versioned actions', async () => {
    const harness = await open('overview/' + runId, ['payroll:read', 'payroll:closing:execute', 'payroll:payments:prepare']);
    http.expectOne(root + 'runs/' + runId).flush({ data: { ...run, status: 'APPROVED', version: 7 } });
    await render(harness);
    http.expectOne(root + 'periods/' + periodId).flush({ data: period });
    flushRunResources('APPROVED', 7);
    await render(harness);
    expect(button(harness, 'Prepare payment instructions')).toBeUndefined();
    button(harness, 'Close payroll run')!.click();
    await render(harness);
    http.expectNone(root + 'runs/' + runId + '/close');
    button(harness, 'Confirm close payroll run')!.click();
    const close = http.expectOne(root + 'runs/' + runId + '/close');
    expect(close.request.body).toEqual({ expectedVersion: 7 });
    close.flush({ data: { ...run, status: 'CLOSED', version: 8 } });
    flushRunResources('CLOSED', 8);
    await render(harness);
    http.match(root + 'runs/' + runId + '/summary').forEach(summary => summary.flush({ data: { employees: 1 } }));
    expect(button(harness, 'Close payroll run')).toBeUndefined();
    button(harness, 'Prepare payment instructions')!.click();
    await render(harness);
    button(harness, 'Confirm prepare payment instructions')!.click();
    const instruction = http.expectOne(root + 'runs/' + runId + '/payment-instructions');
    expect(instruction.request.method).toBe('POST');
    expect(instruction.request.body).toEqual({ expectedVersion: 8 });
    instruction.flush({ data: [] });
    flushRunResources('CLOSED', 8);
    await render(harness);
    expect(harness.routeNativeElement?.textContent).toContain('Payment instructions prepared.');
  });

  it('waits for the queued validation version before enabling processing', async () => {
    const harness = await open('pre-processing/' + runId, ['payroll:read', 'payroll:runs:validate', 'payroll:runs:process']);
    http.expectOne(root + 'runs/' + runId).flush({ data: run });
    await render(harness);
    http.expectOne(root + 'periods/' + periodId).flush({ data: period });
    flushRunResources('DRAFT', 1);
    await render(harness);
    button(harness, 'Queue pre-validation')!.click();
    const request = http.expectOne(root + 'runs/' + runId + '/validate');
    expect(request.request.body).toEqual({ expectedVersion: 1 });
    request.flush({ data: { id: 'validation-job' } });
    flushRunResources('VALIDATING', 2);
    await render(harness);
    http.match(root + 'runs/' + runId + '/summary').forEach(summary => summary.flush({ data: { employees: 0 } }));
    expect(button(harness, 'Start processing')).toBeUndefined();
    button(harness, 'Refresh run')!.click();
    flushRunResources('VALIDATING', 3);
    await render(harness);
    http.match(root + 'runs/' + runId + '/summary').forEach(summary => summary.flush({ data: { employees: 0 } }));
    button(harness, 'Start processing')!.click();
    const start = http.expectOne(root + 'runs/' + runId + '/process');
    expect(start.request.body).toEqual({ expectedVersion: 3 });
    start.flush({ data: { ...run, status: 'PROCESSING', version: 4 } });
    flushRunResources('PROCESSING', 4);
    await render(harness);
    http.match(root + 'runs/' + runId + '/summary').forEach(summary => summary.flush({ data: { employees: 0 } }));
  });

  it('uses the correction endpoint with the source run in the path', () => {
    const api = TestBed.inject(PayrollApi);
    api.createRun(18, {
      periodId, originalRunId: runId, runType: 'CORRECTION', executionScope: 'INDIVIDUAL',
      employeeIds: [employeeId], reason: 'Corrected input', idempotencyKey: 'correction-key',
    }).subscribe();
    const correction = http.expectOne(root + 'runs/' + runId + '/corrections');
    expect(correction.request.body).toEqual({
      periodId, executionScope: 'INDIVIDUAL', employeeIds: [employeeId], reason: 'Corrected input', idempotencyKey: 'correction-key',
    });
    correction.flush({ data: { ...run, runType: 'CORRECTION', originalRunId: runId } });
  });

  it('aggregates only employee results in the selected department', async () => {
    const harness = await open('overview', ['payroll:read', 'payroll:results:read-sensitive', 'organization:read']);
    const secondEmployee = '0a9980ad-3067-4c68-afb7-b0d063425f32';
    const department = { id: 'finance', name: 'Finance', data: {} };
    const page = <T>(data: T[]) => ({ data, total: data.length, page: 1, limit: 100 });
    const organizationPage = <T>(data: T[]) => ({ data, pagination: { total: data.length, page: 1, limit: 100, totalPages: 1 } });
    http.expectOne(request => request.url === root + 'periods').flush({ data: page([period]) });
    http.expectOne(request => request.url === root + 'runs').flush({ data: page([
      { ...run, status: 'CLOSED', employeeIds: [employeeId, secondEmployee] },
    ]) });
    http.expectOne(request => request.url === '/api/v1/organization/establishments').flush(organizationPage([]));
    http.expectOne(request => request.url === '/api/v1/organization/departments').flush(organizationPage([department]));
    await render(harness);
    const amounts = { grossAmount: '170.00', deductionsAmount: '0.00', netAmount: '170.00', employerCostsAmount: '0.00', currency: 'AOA' };
    http.expectOne(root + 'runs/' + runId + '/summary').flush({ data: { ...amounts, employees: 2 } });
    await render(harness);
    expect(harness.routeNativeElement?.textContent).toContain('170,00 Kz');
    const select = harness.routeNativeElement!.querySelector<HTMLSelectElement>('select[name="payroll-department"]')!;
    select.value = department.id;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await render(harness);
    const membership = http.expectOne(request => request.url === '/api/v1/organization/departments/finance/employees');
    expect(membership.request.headers.get('X-Company-Id')).toBe('18');
    membership.flush(organizationPage([
      { employeeId, status: 'ACTIVE', effectiveFrom: '2026-11-01' },
      { employeeId: secondEmployee, status: 'ACTIVE', effectiveFrom: '2026-12-01' },
    ]));
    await render(harness);
    http.expectOne(root + 'runs/' + runId + '/results').flush({ data: [
      { ...amounts, employeeId, netAmount: '70.00' },
      { ...amounts, employeeId: secondEmployee, netAmount: '100.00' },
    ] });
    await render(harness);
    expect(harness.routeNativeElement?.textContent).toContain('70,00 Kz');
    expect(harness.routeNativeElement?.textContent).not.toContain('170,00 Kz');
  });

  it('shows calculation evidence and keeps a pending export when changing tabs', async () => {
    const runUrl = root + 'runs/' + runId;
    const resultId = '59cb6e96-209d-4835-a01b-e6ce706dd31a';
    const exportId = '75bc9122-e813-458e-988d-25d147ae3c35';
    const harness = await open('worksheets/' + runId, ['payroll:read', 'payroll:results:read-sensitive', 'payroll:export']);
    http.expectOne(runUrl).flush({ data: { ...run, status: 'CLOSED', version: 8 } });
    await render(harness);
    http.expectOne(root + 'periods/' + periodId).flush({ data: period });
    flushRunResources('CLOSED', 8);
    const result = { id: resultId, employeeId, currency: 'AOA', grossAmount: '100.00', deductionsAmount: '10.00', netAmount: '90.00', employerCostsAmount: '5.00' };
    http.expectOne(runUrl + '/results').flush({ data: [result] });
    await render(harness);
    button(harness, employeeId)!.click();
    await render(harness);
    http.expectOne(runUrl + '/results/' + resultId).flush({ data: result });
    http.expectOne(runUrl + '/results/' + resultId + '/explanation').flush({ data: {
      ...result, engineVersion: 'engine-v1', legalRuleSetVersion: 'legal-v1', calculationTraceId: 'trace-1',
      lines: [{ code: 'BASE', type: 'EARNING', amount: '100.00', sourceReference: 'contract-v1' }],
    } });
    await render(harness);
    expect(harness.routeNativeElement?.textContent).toContain('legal-v1');
    expect(harness.routeNativeElement?.textContent).toContain('contract-v1');
    button(harness, 'Request export')!.click();
    const request = http.expectOne(root + 'exports');
    expect(request.request.body).toEqual({ runId, format: 'PDF', idempotencyKey: jasmine.any(String) });
    request.flush({ data: { id: exportId, status: 'PENDING' } });
    await render(harness);
    button(harness, 'Totals')!.click();
    await render(harness);
    http.expectOne(runUrl + '/summary').flush({ data: { employees: 1, ...result } });
    button(harness, 'Employee results')!.click();
    await render(harness);
    http.expectOne(runUrl + '/results').flush({ data: [result] });
    button(harness, 'Download PDF')!.click();
    const download = http.expectOne(root + 'exports/' + exportId + '/download');
    expect(download.request.responseType).toBe('blob');
    expect(download.request.headers.get('X-Company-Id')).toBe('18');
    download.flush(new Blob(), { status: 409, statusText: 'Conflict' });
  });

  it('keeps cent precision above safe integer ranges', () => {
    expect(centsAmount(payrollCents('9007199254740999.98') + payrollCents('0.01'))).toBe('9007199254740999.99');
    expect(payrollMoney('9007199254740999.98', 'AOA')).toContain(',98 Kz');
    expect(payrollMoney('-0.01', 'AOA')).toBe('-0,01 Kz');
  });
});
