import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { AuthSessionStore } from '../auth/application/auth-session.store';
import { NOTIFICATIONS_ACCESS, notificationGrant } from './domain/notifications.navigation';

describe('Notifications workspace', () => {
  let http: HttpTestingController;
  const personal = '/api/v1/notifications/personal/me';
  const admin = '/api/v1/platform/notifications';
  const entry = {
    id: '4c97da49-5b60-4eaa-bdb5-3cca173af9f1', createdAt: '2026-11-23T09:00:00.000Z',
    data: { subject: 'New company notice', body: 'Please review the handbook.', readState: 'UNREAD', category: 'ANNOUNCEMENT' },
  };
  const signIn = (permissions: string[]) => {
    const claims = btoa(JSON.stringify({ sub: '909', sessionId: '2', roles: ['SUPER_ADMIN'], permissions, exp: 4102444800, type: 'access' }));
    TestBed.inject(AuthSessionStore).accept({ accessToken: 'header.' + claims + '.signature' });
  };
  const button = (view: Element, label: string) =>
    [...view.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.trim() === label)!;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('requires the general grant and the section grant and uses the selected company API', async () => {
    signIn([NOTIFICATIONS_ACCESS]);
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/notifications/failures?companyId=7');
    expect(TestBed.inject(Router).url).toContain('/access-denied?area=notifications');
    http.expectNone(request => request.url.startsWith(admin));
    signIn([NOTIFICATIONS_ACCESS, notificationGrant('deliveries:read')]);
    await harness.navigateByUrl('/notifications/failures?companyId=7');
    const request = http.expectOne(request => request.url === admin + '/companies/7/deliveries');
    expect(request.request.params.get('status')).toBe('FAILED_PERMANENT');
    request.flush({ data: { items: [], page: 1, limit: 25, total: 0 } });
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('No records match this view');
  });

  it('uses the real inbox in the header and decrements the count only after a read', async () => {
    signIn([]);
    const harness = await RouterTestingHarness.create('/notifications/inbox');
    http.expectOne(request => request.url === personal).flush({ data: [entry] });
    http.expectOne(personal + '/unread-count').flush({ data: { count: 1 } });
    harness.detectChanges();
    const view = harness.routeNativeElement!;
    const bell = view.querySelector<HTMLButtonElement>('app-notification-dropdown button')!;
    expect(bell.getAttribute('aria-label')).toBe('Notifications, 1 unread');
    bell.click();
    harness.detectChanges();
    await harness.fixture.whenStable();
    http.expectOne(request => request.url === personal).flush({ data: [entry] });
    http.expectOne(personal + '/unread-count').flush({ data: { count: 1 } });
    harness.detectChanges();
    expect(view.querySelector('#notification-popover')?.textContent).toContain(entry.data.subject);
    expect(bell.getAttribute('aria-label')).toBe('Notifications, 1 unread');
    button(view, 'Mark as read').click();
    const mark = http.expectOne(personal + '/' + entry.id + '/read');
    expect(mark.request.method).toBe('POST');
    mark.flush({ data: {} });
    http.expectOne(request => request.url === personal).flush({ data: [{ ...entry, data: { ...entry.data, readState: 'READ' } }] });
    http.expectOne(personal + '/unread-count').flush({ data: { count: 0 } });
    harness.detectChanges();
    expect(bell.getAttribute('aria-label')).toBe('Notifications');
  });
});
