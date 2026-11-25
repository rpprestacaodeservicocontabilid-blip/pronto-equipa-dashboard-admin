import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { AuthSessionStore } from '../auth/application/auth-session.store';

describe('Platform integrations', () => {
  const endpoint = '/api/v1/integrations/admin/catalog';
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

  it('denies direct access to company administrators', async () => {
    signIn('ADMIN');
    await RouterTestingHarness.create('/integrations/catalogue');
    expect(TestBed.inject(Router).url).toContain('/access-denied?area=integrations');
    http.expectNone(endpoint);
  });

  it('shows available inventory alongside source restrictions and failures', async () => {
    signIn('SUPER_ADMIN');
    const harness = await RouterTestingHarness.create('/integrations/catalogue');
    harness.detectChanges();
    http.expectOne(endpoint).flush({ data: { observedAt: '2026-11-25T10:00:00Z', sources: [
      { source: 'PAYMENTS', status: 'RESTRICTED' },
      { source: 'NOTIFICATIONS', status: 'AVAILABLE', total: 1,
        providers: [{ id: 'EMAIL', name: 'Email', type: 'EMAIL', state: 'CONFIGURED' }] },
      { source: 'AI', status: 'UNAVAILABLE' },
    ] } });
    await harness.fixture.whenStable();
    harness.detectChanges();
    const view = harness.routeNativeElement!.textContent;
    expect(view).toContain('Configuration present');
    expect(view).toContain('requires its module-specific permission');
    expect(view).toContain('could not be loaded');
  });
});
