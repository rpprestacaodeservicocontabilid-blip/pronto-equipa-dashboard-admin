import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ResolveStart, Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { filter, firstValueFrom } from 'rxjs';
import { routes } from './app.routes';
import { AuthService } from './modules/auth/application/auth.service';
import { AUTH_STORAGE_KEY, AuthSessionStore } from './modules/auth/application/auth-session.store';
import { SignInComponent } from './pages/auth-pages/sign-in/sign-in.component';

describe('Dashboard entry routes', () => {
  beforeEach(() => TestBed.configureTestingModule({
    providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
  }));
  afterEach(() => localStorage.removeItem(AUTH_STORAGE_KEY));

  it('renders sign-in when opening the root URL', async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ accessToken: 'stale', session: { id: '3' } }));
    const http = TestBed.inject(HttpTestingController);
    const restoration = TestBed.inject(AuthService).restore();
    http.expectOne('/api/v1/auth/browser/refresh').flush(null, { status: 204, statusText: 'No Content' });
    await restoration;
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/', SignInComponent);
    expect(TestBed.inject(Router).url).toBe('/signin');
    expect(harness.routeNativeElement?.querySelector('input[autocomplete="username"]')).not.toBeNull();
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    http.verify();
  });

  it('keeps the requested page when a fresh application restores an active browser session', async () => {
    const http = TestBed.inject(HttpTestingController);
    const auth = TestBed.inject(AuthService);
    const restoration = auth.restore();
    const claims = btoa(JSON.stringify({
      sub: '5', sessionId: '3', roles: ['SUPER_ADMIN'], permissions: ['payments.platform.read'],
      exp: 4102444800, type: 'access',
    }));
    http.expectOne('/api/v1/auth/browser/refresh').flush({ accessToken: 'header.' + claims + '.signature' });
    await restoration;
    const harness = await RouterTestingHarness.create('/payments/pending');
    await harness.fixture.whenStable();
    http.expectOne(request => request.url === '/api/v1/platform/payments/orders'
      && request.params.get('incident') === 'pending').flush({ data: { items: [], total: 0, page: 1, limit: 25 } });
    expect(TestBed.inject(Router).url).toBe('/payments/pending');
    expect(auth.claims()?.sessionId).toBe('3');
    http.verify();
  });

  it('opens Onboarding review for a super-admin and loads only applications pending review', async () => {
    const claims = btoa(JSON.stringify({
      sub: '5', sessionId: '3', roles: ['SUPER_ADMIN'], permissions: [], exp: 4102444800, type: 'access',
    }));
    TestBed.inject(AuthSessionStore).accept({ accessToken: 'header.' + claims + '.signature', refreshToken: 'refresh' });
    const harness = await RouterTestingHarness.create('/onboarding/approvals');
    const http = TestBed.inject(HttpTestingController);
    const directory = http.expectOne(request => request.url === '/api/v1/onboarding/admin/directory');
    expect(directory.request.params.get('status')).toBe('PENDING_REVIEW');
    directory.flush({ data: { items: [], total: 0, page: 1, limit: 20 } });
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector('a[href="/onboarding/approvals"]')).not.toBeNull();
    expect(harness.routeNativeElement!.textContent).toContain('No applications match these filters');
    http.verify();
  });

  it('denies Onboarding to regular accounts before reading administrative data', async () => {
    const claims = btoa(JSON.stringify({
      sub: '5', sessionId: '3', roles: [], permissions: [], exp: 4102444800, type: 'access',
    }));
    TestBed.inject(AuthSessionStore).accept({ accessToken: 'header.' + claims + '.signature', refreshToken: 'refresh' });
    const harness = await RouterTestingHarness.create('/onboarding/approvals');
    expect(harness.routeNativeElement!.textContent).toContain('Onboarding access required');
    TestBed.inject(HttpTestingController).verify();
  });

  it('uses platform telemetry for monthly payslips and exposes the reordering handle', async () => {
    const claims = btoa(JSON.stringify({
      sub: '5', sessionId: '3', roles: ['SUPER_ADMIN'], permissions: [], exp: 4102444800, type: 'access',
    }));
    TestBed.inject(AuthSessionStore).accept({ accessToken: 'header.' + claims + '.signature', refreshToken: 'refresh' });
    const harness = await RouterTestingHarness.create('/payslips/monthly');
    const http = TestBed.inject(HttpTestingController);
    const companies = http.expectOne(request => request.url === '/api/v1/platform/payslips/companies');
    companies.flush({ data: { items: [], total: 0, page: 1, limit: 50 } });
    const volume = http.expectOne(request => request.url === '/api/v1/platform/payslips/volume');
    expect(volume.request.params.get('type')).toBe('REGULAR');
    volume.flush({ data: [{ period: '2026-11', type: 'REGULAR', status: 'PUBLISHED', total: 42 }] });
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('button[aria-label="Reorder Monthly payslips"]')).not.toBeNull();
    expect(harness.routeNativeElement?.textContent).toContain('42 receipts');
    http.verify();
  });

  it('requires a platform role for payslip supervision even with tenant sensitive-read grants', async () => {
    const claims = btoa(JSON.stringify({
      sub: '5', sessionId: '3', roles: [], permissions: ['payslips:read-sensitive'], exp: 4102444800, type: 'access',
    }));
    TestBed.inject(AuthSessionStore).accept({ accessToken: 'header.' + claims + '.signature', refreshToken: 'refresh' });
    const harness = await RouterTestingHarness.create('/payslips/overview');
    expect(harness.routeNativeElement?.textContent).toContain('Payslip supervision access required');
    TestBed.inject(HttpTestingController).verify();
  });

  it('loads the platform report catalogue for a super-admin and links to analysis', async () => {
    const claims = btoa(JSON.stringify({
      sub: '5', sessionId: '3', roles: ['SUPER_ADMIN'], permissions: [], exp: 4102444800, type: 'access',
    }));
    TestBed.inject(AuthSessionStore).accept({ accessToken: 'header.' + claims + '.signature', refreshToken: 'refresh' });
    const harness = await RouterTestingHarness.create('/reports/catalog');
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/v1/platform/reports/catalog').flush({ data: [{
      code: 'REPORT_ACTIVITY', title: 'Report activity', category: 'Reporting', companyFilter: true,
      source: 'Reports registry', description: 'Operational counts', version: 1,
    }] });
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('a[href="/reports/analysis?code=REPORT_ACTIVITY"]')).not.toBeNull();
    expect(harness.routeNativeElement?.querySelector('button[aria-label="Reorder Report catalogue"]')).not.toBeNull();
    http.verify();
  });

  it('keeps platform reports separate from company report permissions', async () => {
    const claims = btoa(JSON.stringify({
      sub: '5', sessionId: '3', roles: [], permissions: ['reports:execute', 'reports:salary:read-sensitive'],
      exp: 4102444800, type: 'access',
    }));
    TestBed.inject(AuthSessionStore).accept({ accessToken: 'header.' + claims + '.signature', refreshToken: 'refresh' });
    const harness = await RouterTestingHarness.create('/reports/executions');
    expect(harness.routeNativeElement?.textContent).toContain('Platform reports access required');
    TestBed.inject(HttpTestingController).verify();
  });

  it('shows a retry screen and retains the return URL when the session API is unavailable', async () => {
    const cached = JSON.stringify({ session: { id: '3' } });
    localStorage.setItem(AUTH_STORAGE_KEY, cached);
    const http = TestBed.inject(HttpTestingController);
    const restoration = TestBed.inject(AuthService).restore();
    http.expectOne('/api/v1/auth/browser/refresh').flush({}, { status: 503, statusText: 'Service Unavailable' });
    await restoration;
    const harness = await RouterTestingHarness.create('/companies');
    const router = TestBed.inject(Router);
    expect(router.url).toBe('/session-unavailable?returnUrl=%2Fcompanies');
    expect(harness.routeNativeElement?.textContent).toContain('Could not restore your session');
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBe(cached);
    http.verify();
  });

  it('scopes attendance reads and gates period close on server validation', async () => {
    const claims = btoa(JSON.stringify({
      sub: '5', sessionId: '3', roles: [], permissions: [], exp: 4102444800, type: 'access',
    }));
    TestBed.inject(AuthSessionStore).accept({ accessToken: 'header.' + claims + '.signature', refreshToken: 'refresh' });
    const requests = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    const harness = await RouterTestingHarness.create();
    const id = 'db42f487-c606-4926-af02-22ad9d75f984';
    const resolving = firstValueFrom(router.events.pipe(filter(event => event instanceof ResolveStart)));
    const navigation = harness.navigateByUrl('/attendance/18/periods/' + id);
    await resolving;
    const access = requests.expectOne('/api/v1/company/context');
    expect(access.request.headers.get('X-Company-Id')).toBe('18');
    access.flush({ data: { company: { id: 18, name: 'Example Company', status: 'ACTIVE' },
      permissions: ['attendance.periods.read', 'attendance.periods.manage', 'attendance.periods.close'] } });
    await navigation;

    const periodUrl = '/api/v1/attendance/periods/' + id;
    const period = { id, type: 'PERIOD', status: 'OPEN', version: 1, periodStart: '2026-11-01', periodEnd: '2026-11-30',
      createdAt: '2026-11-01T00:00:00Z', data: {} };
    const flushPeriod = (payload: typeof period, snapshots: object[] = []) => {
      const detail = requests.expectOne(periodUrl);
      expect(detail.request.headers.get('X-Company-Id')).toBe('18');
      detail.flush({ data: payload });
      requests.expectOne(periodUrl + '/snapshots').flush({ data: snapshots });
      harness.detectChanges();
    };
    const button = (label: string) => Array.from(harness.routeNativeElement!.querySelectorAll('button'))
      .find(candidate => candidate.textContent.trim() === label);
    flushPeriod(period);
    expect(button('Close period')).toBeUndefined();
    button('Validate period')!.click();
    harness.detectChanges();
    await harness.fixture.whenStable();
    const form = harness.routeNativeElement!.querySelector('form')!;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const validation = requests.expectOne(periodUrl + '/validate');
    expect(validation.request.method).toBe('POST');
    expect(validation.request.headers.get('X-Company-Id')).toBe('18');
    const ready = { ...period, status: 'READY_TO_CLOSE', version: 2 };
    validation.flush({ data: { period: ready, readyToClose: true } });
    flushPeriod(ready);
    expect(button('Close period')).toBeDefined();
    button('Close period')!.click();
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(button('Close period and generate snapshot')?.disabled).toBeTrue();
    harness.routeNativeElement!.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    requests.expectNone(periodUrl + '/close');
    harness.routeNativeElement!.querySelector<HTMLInputElement>('input[name="confirm"]')!.click();
    harness.detectChanges();
    button('Close period and generate snapshot')!.click();
    const closing = requests.expectOne(periodUrl + '/close');
    expect(closing.request.method).toBe('POST');
    expect(closing.request.headers.get('X-Company-Id')).toBe('18');
    const closed = { ...ready, status: 'CLOSED', version: 3 };
    const snapshot = { id: 'snapshot', status: 'IMMUTABLE', version: 1, data: { dayCount: 0, days: [] } };
    closing.flush({ data: { period: closed, snapshot } });
    flushPeriod(closed, [snapshot]);
    expect(button('Close period')).toBeUndefined();
    expect(button('Export snapshot CSV')).toBeDefined();
    requests.verify();
  });

  it('does not read company attendance using platform permissions alone', async () => {
    const claims = btoa(JSON.stringify({
      sub: '5', sessionId: '3', roles: ['SUPER_ADMIN'], permissions: ['attendance.punches.read'],
      exp: 4102444800, type: 'access',
    }));
    TestBed.inject(AuthSessionStore).accept({ accessToken: 'header.' + claims + '.signature', refreshToken: 'refresh' });
    const requests = TestBed.inject(HttpTestingController);
    const resolving = firstValueFrom(TestBed.inject(Router).events.pipe(filter(event => event instanceof ResolveStart)));
    const harness = await RouterTestingHarness.create();
    const navigation = harness.navigateByUrl('/attendance/18/records');
    await resolving;
    requests.expectOne('/api/v1/company/context').flush({
      data: { company: { id: 18, name: 'Example Company', status: 'ACTIVE' }, permissions: [] },
    });
    await navigation;
    expect(harness.routeNativeElement?.textContent).toContain('Your company permissions do not include attendance management');
    requests.expectNone(request => request.url.startsWith('/api/v1/attendance'));
    requests.verify();
  });

  it('retains the company contract URL when it redirects an unauthenticated user', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/contracts/18/expiring', SignInComponent);
    const router = TestBed.inject(Router);
    expect(router.url.split('?')[0]).toBe('/signin');
    expect(router.parseUrl(router.url).queryParams['returnUrl']).toBe('/contracts/18/expiring');
  });

  it('renders the company dashboard for a tenant reader without exposing administrative actions', async () => {
    const claims = btoa(JSON.stringify({
      sub: '5', sessionId: '3', roles: [], permissions: [], exp: 4102444800, type: 'access',
    }));
    TestBed.inject(AuthSessionStore).accept({ accessToken: 'header.' + claims + '.signature', refreshToken: 'refresh' });
    const requests = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    const harness = await RouterTestingHarness.create();
    const resolving = firstValueFrom(router.events.pipe(filter(event => event instanceof ResolveStart)));
    const navigation = harness.navigateByUrl('/contracts/18');
    await resolving;
    requests.expectOne('/api/v1/company/context').flush({
      data: { company: { id: 18, name: 'Example Company', status: 'ACTIVE' }, permissions: ['contracts.read'] },
    });
    await navigation;
    requests.expectOne(request => request.url === '/api/v1/contracts').flush({
      data: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
    });
    requests.expectOne('/api/v1/contracts/types').flush({ data: [] });
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Example Company');
    expect(harness.routeNativeElement?.textContent).toContain('Total contracts');
    expect(harness.routeNativeElement?.textContent).not.toContain('New contract');
    requests.verify();
  });

  it('requires company permissions to display organization data even for a platform administrator', async () => {
    const claims = btoa(JSON.stringify({
      sub: '5', sessionId: '3', roles: ['SUPER_ADMIN'], permissions: [], exp: 4102444800, type: 'access',
    }));
    TestBed.inject(AuthSessionStore).accept({ accessToken: 'header.' + claims + '.signature', refreshToken: 'refresh' });
    const requests = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    const harness = await RouterTestingHarness.create();
    const resolving = firstValueFrom(router.events.pipe(filter(event => event instanceof ResolveStart)));
    const navigation = harness.navigateByUrl('/organization/18/departments');
    await resolving;
    const request = requests.expectOne('/api/v1/company/context');
    expect(request.request.headers.get('X-Company-Id')).toBe('18');
    request.flush({
      data: { company: { id: 18, name: 'Example Company', status: 'ACTIVE' }, permissions: ['company.read'] },
    });
    await navigation;
    expect(harness.routeNativeElement?.textContent).toContain('does not allow access to Organization');
    requests.expectNone(candidate => candidate.url.startsWith('/api/v1/organization'));
    requests.verify();
  });

  it('renders the scoped department hierarchy and collapses subordinate departments', async () => {
    const claims = btoa(JSON.stringify({
      sub: '5', sessionId: '3', roles: [], permissions: [], exp: 4102444800, type: 'access',
    }));
    TestBed.inject(AuthSessionStore).accept({ accessToken: 'header.' + claims + '.signature', refreshToken: 'refresh' });
    const requests = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    const harness = await RouterTestingHarness.create();
    const resolving = firstValueFrom(router.events.pipe(filter(event => event instanceof ResolveStart)));
    const navigation = harness.navigateByUrl('/organization/18/structure');
    await resolving;
    requests.expectOne('/api/v1/company/context').flush({
      data: { company: { id: 18, name: 'Example Company', status: 'ACTIVE' }, permissions: ['organization:read'] },
    });
    await navigation;
    const tree = requests.expectOne('/api/v1/organization/departments/tree');
    expect(tree.request.headers.get('X-Company-Id')).toBe('18');
    const department = { status: 'ACTIVE', data: {}, version: 1 };
    tree.flush({ data: [{ ...department, name: 'Operations', code: 'OPS', id: 'parent', children: [
      { ...department, name: 'Field Services', code: 'FIELD', id: 'child', children: [] },
    ] }] });
    harness.detectChanges();
    const view = harness.routeNativeElement!;
    expect(view.textContent).toContain('Field Services');
    const toggle = view.querySelector<HTMLButtonElement>('button[aria-label="Toggle Operations"]')!;
    toggle.click();
    harness.detectChanges();
    expect(view.textContent).not.toContain('Field Services');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    requests.verify();
  });

  it('loads only pending requests in the company leave approval queue', async () => {
    const claims = btoa(JSON.stringify({
      sub: '5', sessionId: '3', roles: [], permissions: [], exp: 4102444800, type: 'access',
    }));
    TestBed.inject(AuthSessionStore).accept({ accessToken: 'header.' + claims + '.signature', refreshToken: 'refresh' });
    const requests = TestBed.inject(HttpTestingController);
    const router = TestBed.inject(Router);
    const harness = await RouterTestingHarness.create();
    const resolving = firstValueFrom(router.events.pipe(filter(event => event instanceof ResolveStart)));
    const navigation = harness.navigateByUrl('/leave/18/approvals');
    await resolving;
    requests.expectOne('/api/v1/company/context').flush({
      data: { company: { id: 18, name: 'Example Company', status: 'ACTIVE' }, permissions: ['leave.requests.read'] },
    });
    await navigation;
    const list = requests.expectOne(candidate => candidate.url === '/api/v1/leave/requests');
    expect(list.request.headers.get('X-Company-Id')).toBe('18');
    expect(list.request.params.get('status')).toBe('PENDING_APPROVAL');
    list.flush({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } });
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('Requests awaiting a decision');
    requests.verify();
  });
});
