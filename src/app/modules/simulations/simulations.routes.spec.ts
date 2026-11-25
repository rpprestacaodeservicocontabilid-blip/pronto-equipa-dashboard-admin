import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ResolveStart, Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { filter, firstValueFrom } from 'rxjs';
import { routes } from '../../app.routes';
import { AuthSessionStore } from '../auth/application/auth-session.store';

describe('Simulation administration', () => {
  let http: HttpTestingController;

  async function navigate(url: string, role: string, permissions: string[]) {
    const claims = btoa(JSON.stringify({ sub: '9', sessionId: '4', roles: [role], permissions: [], exp: 4102444800, type: 'access' }));
    TestBed.inject(AuthSessionStore).accept({ accessToken: 'header.' + claims + '.signature' });
    const harness = await RouterTestingHarness.create();
    const resolving = firstValueFrom(TestBed.inject(Router).events.pipe(filter(event => event instanceof ResolveStart)));
    const navigation = harness.navigateByUrl(url);
    await resolving;
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

  it('keeps salary data behind tenant permissions even for SUPER_ADMIN', async () => {
    const harness = await navigate('/simulations/18/individual', 'SUPER_ADMIN', ['simulations:read']);
    http.expectNone(req => req.url.startsWith('/api/v1/simulations/'));
    expect(harness.routeNativeElement?.textContent).toContain('You do not have permission to open this simulation workspace.');
  });

  it('loads the chosen scenario type with the resolved company context', async () => {
    const harness = await navigate('/simulations/18/individual', 'ADMIN', [
      'simulations:read', 'simulations:salary:read-sensitive',
    ]);
    const request = http.expectOne(req => req.url === '/api/v1/simulations/scenarios');
    expect(request.request.headers.get('X-Company-Id')).toBe('18');
    expect(request.request.params.get('type')).toBe('INDIVIDUAL_PAYROLL');
    request.flush({ data: [] });
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('No scenarios for this selection.');
    expect(harness.routeNativeElement?.querySelector('button[aria-label="Reorder Individual payroll"]')).not.toBeNull();
  });
});
