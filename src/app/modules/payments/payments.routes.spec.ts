import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { AUTH_STORAGE_KEY, AuthSessionStore } from '../auth/application/auth-session.store';
import { PAYMENT_PERMISSIONS } from './domain/payment-navigation';

describe('Platform payments navigation', () => {
  const storageKey = 'prontoequipas.sidebar.92082';
  let http: HttpTestingController;

  function signIn(permissions: string[], roles: string[] = ['SUPER_ADMIN']) {
    const claims = btoa(JSON.stringify({ sub: '92082', sessionId: '3', roles, permissions, exp: 4102444800, type: 'access' }));
    TestBed.inject(AuthSessionStore).accept({ accessToken: 'header.' + claims + '.signature', refreshToken: 'refresh' });
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    localStorage.removeItem(storageKey);
  });
  afterEach(() => {
    http.verify();
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(storageKey);
  });

  it('blocks tenant payment permissions and requires an explicit platform grant even for a super-admin', async () => {
    signIn(['payments:read', 'payments:orders:read', 'payments:batches:execute']);
    const harness = await RouterTestingHarness.create('/payments/orders');
    expect(TestBed.inject(Router).url).toBe('/access-denied?area=payments&returnUrl=%2Fpayments%2Forders');
    expect(harness.routeNativeElement!.textContent).toContain('Payments access required');
    expect(harness.routeNativeElement!.textContent).toContain('Platform super-admin');
  });

  it('preserves the Payments destination when the user must sign in', async () => {
    await RouterTestingHarness.create('/payments');
    expect(TestBed.inject(Router).url).toBe('/signin?returnUrl=%2Fpayments');
  });

  it('shows the overview and governance links for a super-admin with the platform grants', async () => {
    signIn(Object.values(PAYMENT_PERMISSIONS));
    const harness = await RouterTestingHarness.create('/payments');
    await harness.fixture.whenStable();
    http.expectOne('/api/v1/platform/payments/overview').flush({ data: {
      totals: [], confirmed: 0, pending: 0, failed: 0, returns: 0, companies: 0, batches: 0, reconciliations: 0,
    } });
    harness.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/payments/overview');
    const module = harness.routeNativeElement!.querySelector('#sidebar-module-payments')!;
    expect(module.querySelector('a[href="/payments/overview"][aria-current="page"]')).not.toBeNull();
    expect(module.querySelector('a[href="/payments/audit"]')).not.toBeNull();
  });

  it('opens the first permitted submenu for a reporting profile', async () => {
    signIn([PAYMENT_PERMISSIONS.reports], ['PLATFORM_REPORTER']);
    const harness = await RouterTestingHarness.create('/payments');
    await harness.fixture.whenStable();
    http.expectOne(request => request.url === '/api/v1/platform/payments/reports'
      && request.params.get('breakdown') === 'status'
      && !request.headers.has('X-Company-Id')).flush({ data: { items: [], page: 1, hasNext: false } });
    harness.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/payments/reports');
    const module = harness.routeNativeElement!.querySelector('#sidebar-module-payments')!;
    expect(module.querySelector('a[href="/payments/reports"][aria-current="page"]')).not.toBeNull();
    expect(module.querySelector('a[href="/payments/orders"]')).toBeNull();
    await harness.navigateByUrl('/payments/orders');
    expect(TestBed.inject(Router).url).toBe('/access-denied?area=payments&returnUrl=%2Fpayments%2Forders');
  });

  it('uses the platform order directory and keeps payment submenus reorderable', async () => {
    signIn([PAYMENT_PERMISSIONS.operations]);
    const harness = await RouterTestingHarness.create('/payments/pending');
    await harness.fixture.whenStable();
    http.expectOne(request => request.url === '/api/v1/platform/payments/orders'
      && request.params.get('incident') === 'pending').flush({ data: { items: [], total: 0, page: 1, limit: 25 } });
    harness.detectChanges();
    const module = harness.routeNativeElement!.querySelector('#sidebar-module-payments')!;
    expect(module.querySelector('a[href="/payments/pending"][aria-current="page"]')).not.toBeNull();
    expect(module.querySelector('a[href="/payments/providers"]')).toBeNull();
    const handle = module.querySelector<HTMLButtonElement>('button[aria-label="Reorder Failed payments"]')!;
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    harness.detectChanges();
    expect(JSON.parse(localStorage.getItem(storageKey)!)['payments/Monitoring'].slice(0, 2)).toEqual(['failed', 'pending']);
  });

  it('requests financial audit records only after a purpose is entered', async () => {
    signIn([PAYMENT_PERMISSIONS.audit], ['AUDITOR']);
    const harness = await RouterTestingHarness.create('/payments/audit');
    harness.detectChanges();
    await harness.fixture.whenStable();
    http.expectNone(request => request.url === '/api/v1/platform/payments/audit');
    const field = harness.routeNativeElement!.querySelector<HTMLInputElement>('input[name="purpose"]')!;
    field.value = 'Investigate bank settlement';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    harness.detectChanges();
    await harness.fixture.whenStable();
    field.form!.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    harness.detectChanges();
    await harness.fixture.whenStable();
    const audit = http.expectOne(request => request.url === '/api/v1/platform/payments/audit');
    expect(audit.request.headers.get('X-Audit-Purpose')).toBe('Investigate bank settlement');
    audit.flush({ data: { items: [], total: 0, page: 1, limit: 25 } });
    harness.detectChanges();
    expect(harness.routeNativeElement!.textContent).toContain('No records match these filters.');
  });
});
