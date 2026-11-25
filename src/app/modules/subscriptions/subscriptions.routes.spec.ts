import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { AuthSessionStore } from '../auth/application/auth-session.store';

describe('Platform subscriptions', () => {
  const api = '/api/v1/subscriptions/admin';
  const id = '43d82ede-a252-4c50-9089-d0795340756a';
  let http: HttpTestingController;
  const signIn = (roles: string[]) => {
    const claims = btoa(JSON.stringify({ sub: '9', sessionId: '4', roles, permissions: [], exp: 4102444800, type: 'access' }));
    TestBed.inject(AuthSessionStore).accept({ accessToken: 'header.' + claims + '.signature' });
  };
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('keeps tenant administrators outside the platform workspace', async () => {
    signIn(['ADMIN']);
    await RouterTestingHarness.create('/subscriptions/plans');
    expect(TestBed.inject(Router).url).toContain('/access-denied?area=subscriptions');
    http.expectNone(request => request.url.startsWith(api));
  });

  it('loads usage for the explicit subscription and company and exposes the draggable submenu', async () => {
    signIn(['SUPER_ADMIN']);
    const harness = await RouterTestingHarness.create('/subscriptions/usage?companyId=7&subscriptionId=' + id);
    const directory = http.expectOne(request => request.url === api + '/subscriptions');
    expect(directory.request.params.get('companyId')).toBe('7');
    expect(directory.request.headers.has('X-Company-Id')).toBeFalse();
    const row = { id, status: 'ACTIVE', companyId: 7 };
    directory.flush({ data: [row] });
    await harness.fixture.whenStable();
    const detail = http.expectOne(request => request.url === api + '/tenants/7/subscription');
    expect(detail.request.params.get('subscriptionId')).toBe(id);
    detail.flush({ data: row });
    await harness.fixture.whenStable();
    http.expectOne(request => request.url === api + '/tenants/7/records/usage/' + id)
      .flush({ data: { items: [{ id, status: 'ACTIVE', metricCode: 'ACTIVE_EMPLOYEES', used: '23', reserved: '0', limit: '50' }], page: 1, total: 1, limit: 25 } });
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('23');
    expect(harness.routeNativeElement?.querySelector('button[aria-label="Reorder Usage and quotas"]')).not.toBeNull();
  });
});
