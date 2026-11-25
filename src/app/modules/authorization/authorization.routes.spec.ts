import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { AuthSessionStore } from '../auth/application/auth-session.store';

describe('Authorization platform console', () => {
  const endpoint = '/api/v1/authorization/admin';
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

  it('blocks tenant administrators from direct navigation', async () => {
    signIn('ADMIN');
    await RouterTestingHarness.create('/authorization/permissions');
    expect(TestBed.inject(Router).url).toContain('/access-denied?area=authorization');
    http.expectNone(request => request.url.startsWith(endpoint));
  });

  it('loads roles for the selected company when opened from its profile', async () => {
    signIn('SUPER_ADMIN');
    const harness = await RouterTestingHarness.create('/authorization/company-roles?companyId=7');
    harness.detectChanges();
    const request = http.expectOne(req => req.url === endpoint + '/roles');
    expect(request.request.params.get('companyId')).toBe('7');
    request.flush({ data: { items: [], page: 1, limit: 25, total: 0 } });
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('No roles found.');
  });
});
