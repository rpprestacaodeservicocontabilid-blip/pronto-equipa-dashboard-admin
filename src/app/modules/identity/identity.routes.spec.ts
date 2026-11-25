import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { AuthSessionStore } from '../auth/application/auth-session.store';

describe('Platform identity administration', () => {
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

  it('rejects direct navigation from company administrators', async () => {
    signIn('ADMIN');
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/identity/users');
    expect(TestBed.inject(Router).url).toContain('/access-denied');
    http.expectNone(req => req.url.startsWith('/api/v1/identity/admin'));
  });

  it('loads the disabled identities filter for a platform administrator', async () => {
    signIn('SUPER_ADMIN');
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/identity/disabled');
    const list = http.expectOne(req => req.url === '/api/v1/identity/admin/identities');
    expect(list.request.params.get('disabled')).toBe('true');
    list.flush({ data: [], page: 1, limit: 25, total: 0 });
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('No identities match this search.');
  });
});
