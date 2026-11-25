import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ResolveStart, Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { filter, firstValueFrom } from 'rxjs';
import { routes } from '../../app.routes';
import { AuthSessionStore } from '../auth/application/auth-session.store';

describe('Documents administration', () => {
  let http: HttpTestingController;
  const signIn = (roles: string[]) => {
    const claims = btoa(JSON.stringify({ sub: '9', sessionId: '4', roles, permissions: [], exp: 4102444800, type: 'access' }));
    TestBed.inject(AuthSessionStore).accept({ accessToken: 'header.' + claims + '.signature' });
  };
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('does not treat the platform role as permission to read a company document', async () => {
    signIn(['SUPER_ADMIN']);
    const harness = await RouterTestingHarness.create();
    const resolving = firstValueFrom(TestBed.inject(Router).events.pipe(filter(event => event instanceof ResolveStart)));
    const navigation = harness.navigateByUrl('/documents/18/library');
    await resolving;
    http.expectOne('/api/v1/company/context').flush({ data: {
      company: { id: 18, name: 'Test company', status: 'ACTIVE' }, permissions: ['documents:read'],
    } });
    await navigation;
    http.expectNone(req => req.url === '/api/v1/documents');
    expect(harness.routeNativeElement?.textContent).toContain('requires company document permissions');
  });

  it('scopes the quarantine queue to the company and hides file access for quarantined records', async () => {
    signIn(['ADMIN']);
    const harness = await RouterTestingHarness.create();
    const resolving = firstValueFrom(TestBed.inject(Router).events.pipe(filter(event => event instanceof ResolveStart)));
    const navigation = harness.navigateByUrl('/documents/18/quarantine');
    await resolving;
    http.expectOne('/api/v1/company/context').flush({ data: {
      company: { id: 18, name: 'Test company', status: 'ACTIVE' },
      permissions: ['documents:read', 'documents:read-sensitive', 'documents:download'],
    } });
    await navigation;
    const request = http.expectOne(req => req.url === '/api/v1/documents');
    expect(request.request.headers.get('X-Company-Id')).toBe('18');
    expect(request.request.params.get('status')).toBe('QUARANTINED');
    request.flush({ data: [{ id: '2f43aefa-8a4c-4269-b267-f30efe14a8fc', name: 'Quarantined attachment', status: 'QUARANTINED' }] });
    await harness.fixture.whenStable();
    harness.detectChanges();
    const view = harness.routeNativeElement!;
    [...view.querySelectorAll('button')].find(button => button.textContent?.trim() === 'View')!.click();
    harness.detectChanges();
    expect(view.textContent).not.toContain('Prepare download');
    expect(view.querySelector('button[aria-label="Reorder Quarantined documents"]')).not.toBeNull();
  });
});
