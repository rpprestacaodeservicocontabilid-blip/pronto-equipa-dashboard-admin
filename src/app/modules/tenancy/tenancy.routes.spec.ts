import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { AuthSessionStore } from '../auth/application/auth-session.store';
import { CompaniesComponent } from './companies.component';
import { Company } from './companies.service';

describe('Platform tenancy', () => {
  const endpoint = '/api/v1/platform/companies';
  const company: Company = { id: 7, name: 'Example Company', slug: 'example-company',
    nif: null, email: null, phone: null, status: 'ACTIVE', timezone: 'Africa/Luanda', locale: 'pt-AO',
    createdAt: '2026-01-01', updatedAt: '2026-01-01' };
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  function signIn(role: string) {
    const claims = btoa(JSON.stringify({ sub: '9', sessionId: '4', roles: [role], permissions: [], exp: 4102444800, type: 'access' }));
    TestBed.inject(AuthSessionStore).accept({ accessToken: 'header.' + claims + '.signature' });
  }

  it('blocks tenant administrators from opening a platform company profile', async () => {
    signIn('ADMIN');
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/companies/profile/7');
    expect(TestBed.inject(Router).url).toContain('/access-denied');
    http.expectNone(req => req.url.startsWith(endpoint));
  });

  it('refreshes the server-side status filter after a suspension', async () => {
    signIn('SUPER_ADMIN');
    const harness = await RouterTestingHarness.create('/companies/active');
    const page = (data: Company[]) => ({ success: true, data,
      pagination: { page: 1, limit: 20, total: data.length, totalPages: 1 } });
    const list = http.expectOne(req => req.url === endpoint);
    expect(list.request.params.get('status')).toBe('ACTIVE');
    list.flush(page([company]));
    await harness.fixture.whenStable();
    harness.detectChanges();
    const component: CompaniesComponent = harness.routeDebugElement!.query(By.directive(CompaniesComponent)).componentInstance;
    component.selectStatusChange(company);
    component.reason = '  Account review  ';
    const pending = component.confirmStatus();
    const change = http.expectOne(endpoint + '/7/suspend');
    expect(change.request.body).toEqual({ reason: 'Account review' });
    change.flush({ data: { ...company, status: 'SUSPENDED' } });
    await Promise.resolve();
    const refresh = http.expectOne(req => req.url === endpoint);
    expect(refresh.request.params.get('status')).toBe('ACTIVE');
    refresh.flush(page([]));
    await pending;
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('No companies found.');
  });
});
