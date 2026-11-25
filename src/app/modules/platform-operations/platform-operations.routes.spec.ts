import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { AuthSessionStore } from '../auth/application/auth-session.store';

describe('Platform operations routes', () => {
  const api = '/api/v1/platform-operations/';
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

  it('blocks a company administrator before querying operational data', async () => {
    signIn('ADMIN');
    await RouterTestingHarness.create('/platform-operations/queues');
    expect(TestBed.inject(Router).url).toContain('/access-denied?area=platform-operations');
    http.expectNone(request => request.url.startsWith(api));
  });

  it('shows unavailable counters as absent', async () => {
    signIn('SUPER_ADMIN');
    const harness = await RouterTestingHarness.create('/platform-operations/queues');
    harness.detectChanges();
    http.expectOne(api + 'queues').flush({ data: { observedAt: '2026-11-25T10:00:00Z', queues: [
      { key: 'payroll', name: 'payroll-employee', localWorker: 'RUNNING', status: 'UNAVAILABLE', counts: null },
      { key: 'notifications', localWorker: 'NOT_STARTED', status: 'NOT_STARTED', counts: null },
    ] } });
    await harness.fixture.whenStable();
    harness.detectChanges();
    const text = harness.routeNativeElement!.textContent;
    expect(text).toContain('Unavailable');
    expect(text).toContain('Not started');
    expect(text).toContain('—');
  });
});
