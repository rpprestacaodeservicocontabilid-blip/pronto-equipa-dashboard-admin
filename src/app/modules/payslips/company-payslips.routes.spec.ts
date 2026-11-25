import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ResolveStart, Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { filter, firstValueFrom } from 'rxjs';
import { routes } from '../../app.routes';
import { AuthSessionStore } from '../auth/application/auth-session.store';

describe('Company payslip administration', () => {
  let http: HttpTestingController;

  async function open(path: string, permissions: string[]) {
    const claims = btoa(JSON.stringify({ sub: '9', sessionId: '4', roles: ['SUPER_ADMIN'], permissions: [], exp: 4102444800, type: 'access' }));
    TestBed.inject(AuthSessionStore).accept({ accessToken: 'header.' + claims + '.signature' });
    const harness = await RouterTestingHarness.create();
    const context = firstValueFrom(TestBed.inject(Router).events.pipe(filter(event => event instanceof ResolveStart)));
    const navigation = harness.navigateByUrl('/company-payslips/18/' + path);
    await context;
    http.expectOne('/api/v1/company/context').flush({ data: {
      company: { id: 18, name: 'Test company', status: 'ACTIVE' }, permissions,
    } });
    await navigation;
    return harness;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('requires company salary permissions for a platform administrator to read payslips', async () => {
    const harness = await open('register', ['payslips:read']);
    http.expectNone(request => request.url === '/api/v1/payslips');
    expect(harness.routeNativeElement?.textContent).toContain('Your company permissions do not include this payslip workspace.');
  });

  it('issues a payslip from the selected worker result and published template in the active company', async () => {
    const harness = await open('issue', ['payslips:read', 'payslips:read-sensitive', 'payslips:generate']);
    const runId = '56d7fe07-a502-4daf-989e-f2548a8ab791';
    const resultId = 'c40fd02a-3a51-4c1d-a40a-e880814786a4';
    const employeeId = 'cf438521-e45d-4218-98df-c2df09794c49';
    const versionId = 'b06c1074-fb7b-4ceb-8b78-dddb58aa092d';
    const settle = async () => { await harness.fixture.whenStable(); harness.detectChanges(); };
    const run = http.expectOne(request => request.url === '/api/v1/payslips/issuance/runs');
    expect(run.request.headers.get('X-Company-Id')).toBe('18');
    run.flush({ data: { items: [{ id: runId, runType: 'REGULAR' }], more: false } });
    http.expectOne('/api/v1/payslips/issuance/templates').flush({ data: [{ id: versionId, name: 'Standard', version: '1' }] });
    await settle();
    const view = harness.routeNativeElement!;
    function select(name: string, value: string) {
      const field = view.querySelector<HTMLSelectElement>('select[name="' + name + '"]')!;
      field.value = value;
      field.dispatchEvent(new Event('change', { bubbles: true }));
    }
    select('run', runId);
    const results = http.expectOne(request => request.url === '/api/v1/payslips/issuance/runs/' + runId + '/results');
    expect(results.request.headers.get('X-Company-Id')).toBe('18');
    results.flush({ data: { items: [{ id: resultId, name: 'Ana', employeeId, employeeCode: 'A1' }], more: false } });
    await settle();
    select('template', versionId);
    view.querySelector<HTMLInputElement>('input[name="workerResult"]')!.click();
    harness.detectChanges();
    view.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    const issue = http.expectOne('/api/v1/payslips');
    expect(issue.request.headers.get('X-Company-Id')).toBe('18');
    expect(issue.request.body).toEqual(jasmine.objectContaining({
      payrollRunId: runId, payrollResultId: resultId, templateVersionId: versionId, employeeId, type: 'REGULAR',
    }));
    issue.flush({ data: { id: 'b9d7f763-0fea-44da-9454-3ca1321d3c87', number: 'PSL-1', type: 'REGULAR', status: 'VALIDATED',
      grossAmount: '100.00', totalDeductions: '10.00', netAmount: '90.00', currency: 'AOA' } });
    await settle();
    expect(view.textContent).toContain('PSL-1');
  });
});
