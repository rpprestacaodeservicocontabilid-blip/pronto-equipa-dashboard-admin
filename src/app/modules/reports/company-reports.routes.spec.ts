import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ResolveStart, Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { filter, firstValueFrom } from 'rxjs';
import { routes } from '../../app.routes';
import { AuthSessionStore } from '../auth/application/auth-session.store';

describe('Company report administration', () => {
  let http: HttpTestingController;

  async function open(path: string, permissions: string[]) {
    const claims = btoa(JSON.stringify({ sub: '9', sessionId: '4', roles: ['SUPER_ADMIN'], permissions: [], exp: 4102444800, type: 'access' }));
    TestBed.inject(AuthSessionStore).accept({ accessToken: 'header.' + claims + '.signature' });
    const harness = await RouterTestingHarness.create();
    const context = firstValueFrom(TestBed.inject(Router).events.pipe(filter(event => event instanceof ResolveStart)));
    const navigation = harness.navigateByUrl('/company-reports/18/' + path);
    await context;
    http.expectOne('/api/v1/company/context').flush({ data: {
      company: { id: 18, name: 'Test company', status: 'ACTIVE' }, permissions,
    } });
    await navigation;
    return harness;
  }

  function click(harness: RouterTestingHarness, text: string) {
    const button = [...harness.routeNativeElement!.querySelectorAll('button')].find(item => item.textContent?.includes(text));
    expect(button).withContext(text).toBeDefined();
    button?.click();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('requires tenant salary access for fiscal reports even for a platform administrator', async () => {
    const harness = await open('tax', ['reports:catalog:read', 'reports:tax:read']);
    http.expectNone(request => request.url.startsWith('/api/v1/reports/'));
    expect(harness.routeNativeElement?.textContent).toContain('Your company permissions do not include this report workspace.');
  });

  it('executes a company report and exports its saved result by ID', async () => {
    const harness = await open('hr', ['reports:catalog:read', 'reports:hr:read', 'reports:execute', 'reports:exports:create']);
    const catalogue = http.expectOne('/api/v1/reports/catalog');
    expect(catalogue.request.headers.get('X-Company-Id')).toBe('18');
    const definition = { code: 'RPT-HR-001', name: 'Worker register', domain: 'hr', source: 'employees', workspaceFilters: ['from', 'to'] };
    catalogue.flush({ data: [definition] });
    await harness.fixture.whenStable();
    harness.detectChanges();
    click(harness, 'Worker register');
    http.expectOne('/api/v1/reports/catalog/RPT-HR-001').flush({ data: { ...definition, fields: ['firstName'] } });
    await harness.fixture.whenStable();
    harness.detectChanges();
    const workerId = 'cf438521-e45d-4218-98df-c2df09794c49';
    const run = '56d7fe07-a502-4daf-989e-f2548a8ab791';
    click(harness, 'Run report');
    const execution = http.expectOne('/api/v1/reports/executions');
    expect(execution.request.body.code).toBe('RPT-HR-001');
    expect(execution.request.headers.get('X-Company-Id')).toBe('18');
    execution.flush({ data: { id: run, code: definition.code, status: 'COMPLETED', generatedAt: '2026-08-01', rowCount: 1,
      data: [{ employeeId: workerId }] } });
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain(workerId);
    click(harness, 'Generate file');
    const exportRequest = http.expectOne('/api/v1/reports/executions/' + run + '/exports');
    expect(exportRequest.request.body).toEqual({ format: 'CSV' });
    expect(exportRequest.request.headers.get('X-Company-Id')).toBe('18');
    exportRequest.flush({ data: { id: 'b06c1074-fb7b-4ceb-8b78-dddb58aa092d', filename: 'report.csv', status: 'READY', rowCount: 1 } });
    await harness.fixture.whenStable();
  });
});
