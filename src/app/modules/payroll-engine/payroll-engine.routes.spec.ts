import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ResolveStart, Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { filter, firstValueFrom } from 'rxjs';
import { routes } from '../../app.routes';
import { AuthSessionStore } from '../auth/application/auth-session.store';
import { SAMPLE_SCENARIO } from './domain/engine.models';

describe('Payroll engine administrator', () => {
  const company = { id: 18, name: 'Example Company', status: 'ACTIVE' };
  const runId = '6dbf662c-da0f-429b-a25a-1eb29ffa10ae';
  const resultId = '59cb6e96-209d-4835-a01b-e6ce706dd31a';
  const employeeId = '86321fd3-fde1-4bb4-a1e1-835d91623e46';
  const trace = {
    calculationTraceId: 'trace-1', engineVersion: '1.0.1', legalRuleSetVersion: 'synthetic-1',
    legalSourceReference: 'fixture:payroll-engine:synthetic-1', inputHash: 'snapshot-hash', resultHash: 'result-hash',
    roundingPolicy: { mode: 'HALF_EVEN', scale: 2 },
    steps: [{ code: 'BASE_SALARY', description: 'Salary adjusted for effective days.', amount: '100000.00', formula: '100000.00 × 30/30' }],
  };
  const lines = [{ code: 'SAMPLE_ANNUAL_ALLOWANCE', type: 'EARNING', amount: '2500.00', sourceReference: 'fixture:annual-allowance' }];
  const issues = [{ code: 'DEDUCTION_PARTIALLY_APPLIED', severity: 'WARNING', message: 'The requested deduction exceeded the available limit.' }];
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    const claims = btoa(JSON.stringify({ sub: '5', sessionId: '1', roles: [], permissions: [], exp: 4102444800, type: 'access' }));
    TestBed.inject(AuthSessionStore).accept({ accessToken: 'token.' + claims + '.signature', refreshToken: 'refresh' });
  });
  afterEach(() => http.verify());

  async function render(harness: RouterTestingHarness) {
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  async function open(path: string, permissions: string[]) {
    const router = TestBed.inject(Router);
    const harness = await RouterTestingHarness.create();
    const resolving = firstValueFrom(router.events.pipe(filter(event => event instanceof ResolveStart)));
    const navigation = harness.navigateByUrl('/payroll-engine/18/' + path);
    await resolving;
    const context = http.expectOne('/api/v1/company/context');
    expect(context.request.headers.get('X-Company-Id')).toBe('18');
    context.flush({ data: { company, permissions } });
    await navigation;
    await render(harness);
    return harness;
  }

  it('keeps the selected submenu through the company picker and exposes its reorder control', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/payroll-engine?section=traces');
    http.expectOne('/api/v1/companies').flush({ data: [company] });
    await render(harness);
    const page = harness.routeNativeElement!;
    expect(page.querySelector('a[href="/payroll-engine/18/traces"]')?.textContent).toContain(company.name);
    expect(page.querySelector('#sidebar-module-payroll-engine button[aria-label="Reorder Calculation traces"]')).not.toBeNull();
  });

  it('scopes synthetic calculations to the company and displays server evidence', async () => {
    const harness = await open('simulation', ['payroll:read', 'payroll:runs:create']);
    const page = harness.routeNativeElement!;
    const salary = page.querySelector<HTMLInputElement>('input[name="baseSalary"]')!;
    const submit = () => page.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    salary.value = 'not-an-amount';
    salary.dispatchEvent(new Event('input', { bubbles: true }));
    await render(harness);
    submit();
    http.expectNone('/api/v1/payroll/engine/simulate');
    salary.value = '100000,00';
    salary.dispatchEvent(new Event('input', { bubbles: true }));
    await render(harness);
    submit();

    const request = http.expectOne('/api/v1/payroll/engine/simulate');
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('X-Company-Id')).toBe('18');
    expect(request.request.body).toEqual(SAMPLE_SCENARIO);
    request.flush({ data: {
      currency: 'AOA', grossAmount: '110000.00', totalDeductions: '10500.00', netAmount: '99500.00',
      totalEmployerCost: '112200.00', contributionBase: '110000.00', taxableAmount: '110000.00',
      trace, issues, lines,
    } });
    await render(harness);
    expect(page.textContent).toContain('Simulation complete.');
    expect(page.textContent).toContain('SAMPLE_ANNUAL_ALLOWANCE');
    expect(page.textContent).toContain('result-hash');
    expect(page.textContent).toContain('The requested deduction exceeded the available limit.');
  });

  it('blocks a direct trace route without the company sensitive-results permission', async () => {
    const harness = await open('traces?run=' + runId + '&result=' + resultId, ['payroll:read', 'payroll:runs:create']);
    expect(harness.routeNativeElement?.textContent).toContain('Your company role does not allow access');
    http.expectNone(request => request.url.startsWith('/api/v1/payroll/'));
  });

  it('opens a recorded trace through company-scoped Payroll endpoints', async () => {
    const harness = await open('traces?run=' + runId + '&result=' + resultId, ['payroll:read', 'payroll:results:read-sensitive']);
    const runs = '/api/v1/payroll/runs';
    http.expectOne(request => request.url === runs).flush({
      data: { data: [{ id: runId, runType: 'REGULAR', createdAt: '2026-11-03T00:00:00Z' }], total: 1, page: 1, limit: 100 },
    });
    const results = runs + '/' + runId + '/results';
    http.expectOne(results).flush({ data: [{ id: resultId, employeeId, currency: 'AOA', netAmount: '99500.00' }] });
    const evidence = http.expectOne(results + '/' + resultId + '/explanation');
    expect(evidence.request.headers.get('X-Company-Id')).toBe('18');
    evidence.flush({ data: { employeeId, currency: 'AOA', calculationTrace: trace, issues, lines } });
    await render(harness);
    const text = harness.routeNativeElement?.textContent;
    expect(text).toContain('Recorded calculation');
    expect(text).toContain(trace.engineVersion);
    expect(text).toContain('Salary adjusted for effective days.');
  });
});
