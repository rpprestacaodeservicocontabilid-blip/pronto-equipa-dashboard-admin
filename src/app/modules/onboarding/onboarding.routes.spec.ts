import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { AuthSessionStore } from '../auth/application/auth-session.store';

describe('Onboarding administration', () => {
  const root = '/api/v1/onboarding/admin';
  const id = '34314425-37a7-44c3-8a84-d7748101aa25';
  const now = '2026-11-23T09:00:00.000Z';
  const application = {
    id, companyId: 31, companyName: 'Example company', ownerId: 25, mode: 'ADMIN_ASSISTED',
    status: 'AWAITING_PAYMENT', recoverable: false, createdAt: now, updatedAt: now, version: 4,
  };
  const workspace = {
    application, subscriptionStatus: 'PENDING_PAYMENT', activationBlockers: ['subscription-payment'],
    approvalBlockers: [], provisioning: [{ step: 'tenant', status: 'COMPLETED', attempts: 1, updatedAt: now }],
    resources: [], events: [],
  };
  let http: HttpTestingController;
  const signIn = (roles: string[]) => {
    const claims = btoa(JSON.stringify({ sub: '9', sessionId: '3', roles, permissions: [], exp: 4102444800, type: 'access' }));
    TestBed.inject(AuthSessionStore).accept({ accessToken: 'header.' + claims + '.signature' });
  };
  const button = (view: Element, caption: string) =>
    [...view.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.trim() === caption)!;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('protects administrative queues and loads the expired invitations submenu', async () => {
    signIn([]);
    const harness = await RouterTestingHarness.create('/onboarding/expired-invitations');
    expect(TestBed.inject(Router).url).toContain('/access-denied?area=onboarding');
    http.expectNone(request => request.url.startsWith(root));
    signIn(['SUPER_ADMIN']);
    await harness.navigateByUrl('/onboarding/expired-invitations');
    const expired = http.expectOne(request => request.url === root + '/resources/INVITATION');
    expect(expired.request.params.get('status')).toBe('EXPIRED');
    expired.flush({ data: { items: [], total: 0, page: 1, limit: 20 } });
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('button[aria-label="Reorder Expired invitations"]')).not.toBeNull();
  });

  it('blocks activation while payment is pending and sends an audited decision after confirmation', async () => {
    signIn(['SUPER_ADMIN']);
    const harness = await RouterTestingHarness.create('/onboarding/applications/' + id + '?tab=provisioning');
    const endpoint = root + '/applications/' + id;
    http.expectOne(endpoint + '/workspace').flush({ data: workspace });
    await harness.fixture.whenStable();
    harness.detectChanges();
    const view = harness.routeNativeElement!;
    expect(button(view, 'Activate company').disabled).toBeTrue();
    expect(view.textContent).toContain('Wait for confirmation from the subscription service');
    expect(view.textContent).toContain('Attempts');

    button(view, 'Refresh status').click();
    http.expectOne(endpoint + '/workspace').flush({ data: { ...workspace, subscriptionStatus: 'ACTIVE', activationBlockers: [] } });
    await harness.fixture.whenStable();
    harness.detectChanges();
    button(view, 'Activate company').click();
    harness.detectChanges();
    await harness.fixture.whenStable();
    const reason = view.querySelector<HTMLTextAreaElement>('textarea[name="reason"]')!;
    reason.value = 'Subscription confirmed.';
    reason.dispatchEvent(new Event('input', { bubbles: true }));
    harness.detectChanges();
    reason.closest('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const activation = http.expectOne(endpoint + '/activate');
    expect(activation.request.method).toBe('POST');
    expect(activation.request.body).toEqual({ reason: 'Subscription confirmed.' });
    activation.flush({ data: { status: 'COMPLETED' } });
    await harness.fixture.whenStable();
    http.expectOne(endpoint + '/workspace').flush({ data: { ...workspace, application: { ...application, status: 'COMPLETED' }, activationBlockers: [] } });
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(view.textContent).toContain('Company environment activated.');
  });
});
