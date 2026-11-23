import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { AuthSessionStore } from '../auth/application/auth-session.store';
import { SUPPORT_ACCESS, supportGrant } from './domain/support.navigation';

describe('Platform support workspace', () => {
  let http: HttpTestingController;
  const id = '80f89f2c-1067-41d4-868e-1f34b527f0c8';
  const ticket = { id, ticketNumber: 'SUP-2026-000001', subject: 'Shared request', description: 'A customer request',
    status: 'OPEN', type: 'TECHNICAL_SUPPORT', priority: 'HIGH', messages: [], createdAt: '2026-11-23T09:00:00.000Z' };
  const signIn = (permissions: string[]) => {
    const claims = btoa(JSON.stringify({
      sub: '13190', sessionId: '9', roles: ['SUPER_ADMIN'], permissions, exp: 4102444800, type: 'access',
    }));
    TestBed.inject(AuthSessionStore).accept({ accessToken: 'header.' + claims + '.signature' });
  };
  const button = (view: Element, label: string) =>
    Array.from(view.querySelectorAll<HTMLButtonElement>('button')).find(item => item.textContent?.trim().replace(/\s+/g, ' ') === label)!;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('requires the platform support grant and a company before reading tickets', async () => {
    signIn([]);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/support/tickets');
    expect(TestBed.inject(Router).url).toContain('/access-denied?area=support');
    signIn([SUPPORT_ACCESS, supportGrant('tickets:read-team')]);
    await harness.navigateByUrl('/support/new');
    const view = harness.routeNativeElement!;
    http.expectNone(request => request.url.includes('/platform/support/'));
    button(view, 'Choose company').click();
    http.expectOne(request => request.url === '/api/v1/platform/support/companies')
      .flush({ data: [{ id: 7, name: 'Empresa A' }], page: 1, limit: 15, total: 1 });
    await harness.fixture.whenStable();
    harness.detectChanges();
    button(view, 'Empresa A #7').click();
    await harness.fixture.whenStable();
    const list = http.expectOne(request => request.url === '/api/v1/platform/support/companies/7/tickets');
    expect(list.request.params.get('status')).toBe('OPEN');
    list.flush({ data: [ticket], page: 1, limit: 25, total: 1 });
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(view.textContent).toContain('Shared request');
    expect(view.querySelector('button[aria-label="Reorder New tickets"]')).not.toBeNull();
    await harness.navigateByUrl('/support/new?companyId=8');
    expect(view.textContent).not.toContain('Shared request');
    http.expectOne(request => request.url === '/api/v1/platform/support/companies/8/tickets')
      .flush({ data: [], page: 1, limit: 25, total: 0 });
  });

  it('sends public replies in the selected company and hides notes without their own permission', async () => {
    signIn([SUPPORT_ACCESS, supportGrant('tickets:read-team'), supportGrant('messages:create')]);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/support/tickets/' + id + '?companyId=7');
    const endpoint = '/api/v1/platform/support/companies/7/tickets/' + id;
    http.expectOne(endpoint).flush({ data: ticket });
    await harness.fixture.whenStable();
    harness.detectChanges();
    const view = harness.routeNativeElement!;
    expect(view.textContent).not.toContain('Internal notes');
    http.expectNone(endpoint + '/messages');
    button(view, 'Reply').click();
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
    const body = view.querySelector<HTMLTextAreaElement>('app-support-action textarea')!;
    body.value = 'Please confirm your access.';
    body.dispatchEvent(new Event('input', { bubbles: true }));
    harness.detectChanges();
    button(view, 'Send public reply').click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(view.querySelector('app-support-action [role="alert"]')?.textContent ?? '').toBe('');
    const post = http.expectOne(request => request.url === endpoint + '/messages' && request.method === 'POST');
    expect(post.request.body).toEqual({ body: 'Please confirm your access.', visibility: 'PUBLIC', idempotencyKey: jasmine.any(String) });
    post.flush({ data: { id } });
    await harness.fixture.whenStable();
    http.expectOne(endpoint).flush({ data: ticket });
  });
});
