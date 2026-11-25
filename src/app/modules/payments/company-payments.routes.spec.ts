import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ResolveStart, Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { filter, firstValueFrom } from 'rxjs';
import { routes } from '../../app.routes';
import { AuthSessionStore } from '../auth/application/auth-session.store';

describe('Company payment administration', () => {
  let http: HttpTestingController;

  async function open(path: string, permissions: string[]) {
    const claims = btoa(JSON.stringify({ sub: '9', sessionId: '4', roles: ['SUPER_ADMIN'], permissions: ['payments.platform.read'],
      exp: 4102444800, type: 'access' }));
    TestBed.inject(AuthSessionStore).accept({ accessToken: 'header.' + claims + '.signature' });
    const harness = await RouterTestingHarness.create();
    const resolving = firstValueFrom(TestBed.inject(Router).events.pipe(filter(event => event instanceof ResolveStart)));
    const navigation = harness.navigateByUrl('/company-payments/18/' + path);
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

  it('keeps platform supervision separate from company payment permissions', async () => {
    const harness = await open('execution', []);
    http.expectNone(request => request.url.startsWith('/api/v1/payments/'));
    expect(harness.routeNativeElement?.textContent).toContain('Your company permissions do not include this payment workspace.');
  });

  it('keeps approved batches unsubmitted when the company has no active provider', async () => {
    const harness = await open('execution', ['payments:read', 'payments:providers:read', 'payments:batches:execute']);
    const settle = async () => { await harness.fixture.whenStable(); harness.detectChanges(); };
    const batchId = '56d7fe07-a502-4daf-989e-f2548a8ab791';
    const batch = { id: batchId, status: 'APPROVED', code: 'PAY-1', currency: 'AOA', totalAmount: '100.00', items: [] };
    const list = http.expectOne(request => request.url === '/api/v1/payments/batches');
    expect(list.request.params.get('status')).toBe('APPROVED');
    expect(list.request.headers.get('X-Company-Id')).toBe('18');
    list.flush({ data: [batch], total: 1, page: 1, limit: 25 });
    await settle();
    const view = harness.routeNativeElement!;
    const button = (text: string) => [...view.querySelectorAll('button')].find(item => item.textContent?.trim() === text);
    button('Open')!.click();
    http.expectOne('/api/v1/payments/batches/' + batchId).flush({ data: batch });
    await settle();
    button('Review transfer submission')!.click();
    const providers = http.expectOne('/api/v1/payments/execution-providers');
    expect(providers.request.headers.get('X-Company-Id')).toBe('18');
    providers.flush({ data: [] });
    await settle();
    expect(button('Submit to provider')).toBeUndefined();
    expect(view.textContent).toContain('An installed and active company provider is required for submission.');
    http.expectNone('/api/v1/payments/batches/' + batchId + '/execute');
  });
});
