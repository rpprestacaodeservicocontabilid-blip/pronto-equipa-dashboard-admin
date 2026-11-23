import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService, AuthTokens } from './auth.service';
import { authInterceptor } from './auth.interceptor';
import { AUTH_STORAGE_KEY, AuthSessionStore } from '../../modules/auth/application/auth-session.store';
import { BROWSER_SESSION_WRITE } from '../../modules/auth/infrastructure/auth-api.service';
import { Observable } from 'rxjs';

describe('Platform API authentication', () => {
  let http: HttpClient;
  let requests: HttpTestingController;
  let auth: AuthService;
  const refreshUrl = '/api/v1/auth/browser/refresh';
  const tokens = (name: string, sessionId = '10'): AuthTokens => ({
    accessToken: `header.${btoa(JSON.stringify({ sub: '1', sessionId, type: 'access', exp: 4102444800, roles: ['SUPER_ADMIN'], permissions: [], name }))}.signature`,
  });
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      provideRouter([]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(),
      { provide: BROWSER_SESSION_WRITE, useValue: (_scope: string, action: () => Observable<unknown>) => action() },
    ] });
    http = TestBed.inject(HttpClient);
    requests = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    TestBed.inject(AuthSessionStore).accept(tokens('initial'));
  });
  afterEach(() => {
    requests.verify();
    localStorage.removeItem(AUTH_STORAGE_KEY);
  });

  it('does not disclose tokens to another server or static configuration', () => {
    for (const url of ['https://other.example/api/v1/platform/companies', '/config.json']) {
      http.get(url).subscribe();
      const request = requests.expectOne(url);
      expect(request.request.headers.has('Authorization')).toBeFalse();
      request.flush({});
    }
  });

  it('does not refresh when the server denies a permission', () => {
    http.get('/api/v1/platform/companies').subscribe({ error: () => {} });
    requests.expectOne('/api/v1/platform/companies').flush({}, { status: 403, statusText: 'Forbidden' });
    requests.expectNone(refreshUrl);
  });

  it('authenticates password changes and Google linking but leaves Google login public', () => {
    for (const url of ['/api/v1/auth/change-password', '/api/v1/oauth/google/link', '/api/v1/oauth/google']) {
      http.post(url, {}).subscribe();
      const request = requests.expectOne(url);
      expect(request.request.headers.has('Authorization')).toBe(url !== '/api/v1/oauth/google');
      request.flush({});
    }
  });

  it('does not restore a session from a refresh that finishes after sign-out', () => {
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    auth.refresh().subscribe({ error: () => {} });
    const refresh = requests.expectOne(refreshUrl);
    auth.clear();
    refresh.flush(tokens('late'));
    expect(auth.tokens()).toBeNull();
  });

  it('never replays an old request under a different sign-in session', () => {
    http.patch('/api/v1/platform/companies/2/suspend', {}).subscribe({ error: () => {} });
    const request = requests.expectOne('/api/v1/platform/companies/2/suspend');
    const store = TestBed.inject(AuthSessionStore);
    store.clear();
    store.accept(tokens('another-login'));
    request.flush({}, { status: 401, statusText: 'Unauthorized' });
    requests.expectNone('/api/v1/platform/companies/2/suspend');
    requests.expectNone(refreshUrl);
    expect(auth.tokens()).toEqual(tokens('another-login'));
  });

  it('shares one refresh for concurrent expired requests and retries both', () => {
    let completed = 0;
    http.get('/api/v1/platform/companies?page=1').subscribe(() => completed++);
    http.get('/api/v1/platform/companies?page=2').subscribe(() => completed++);
    const first = requests.expectOne('/api/v1/platform/companies?page=1');
    const second = requests.expectOne('/api/v1/platform/companies?page=2');
    expect(first.request.headers.get('Authorization')).toBe(`Bearer ${tokens('initial').accessToken}`);
    first.flush({}, { status: 401, statusText: 'Unauthorized' });
    second.flush({}, { status: 401, statusText: 'Unauthorized' });
    const refresh = requests.expectOne(refreshUrl);
    expect(refresh.request.withCredentials).toBeTrue();
    expect(refresh.request.headers.get('X-Pronto-Session')).toBe('browser');
    expect(refresh.request.body).toEqual({});
    expect(refresh.request.headers.has('Authorization')).toBeFalse();
    refresh.flush(tokens('new'));
    for (const page of [1, 2]) {
      const retry = requests.expectOne(`/api/v1/platform/companies?page=${page}`);
      expect(retry.request.headers.get('Authorization')).toBe(`Bearer ${tokens('new').accessToken}`);
      retry.flush({});
    }
    expect(completed).toBe(2);
  });

  it('starts a separate refresh for a new sign-in while the previous refresh is pending', () => {
    auth.refresh().subscribe({ error: () => {} });
    const previousRefresh = requests.expectOne(refreshUrl);

    auth.verify(42, '123456').subscribe();
    const verify = requests.expectOne('/api/v1/auth/login/verify-otp');
    expect(verify.request.withCredentials).toBeTrue();
    verify.flush(tokens('second-login', '11'));

    auth.refresh().subscribe();
    const currentRefresh = requests.expectOne(refreshUrl);
    expect(currentRefresh.request.withCredentials).toBeTrue();

    previousRefresh.flush(tokens('late'));
    expect(auth.tokens()).toEqual(tokens('second-login', '11'));
    currentRefresh.flush(tokens('renewed', '11'));
    expect(auth.tokens()).toEqual(tokens('renewed', '11'));
  });

  it('keeps the session on a temporary refresh failure and permits another attempt', () => {
    const url = '/api/v1/platform/companies';
    http.get(url).subscribe({ error: () => {} });
    requests.expectOne(url).flush({}, { status: 401, statusText: 'Unauthorized' });
    requests.expectOne(refreshUrl).flush({}, { status: 503, statusText: 'Service Unavailable' });
    expect(auth.tokens()).toEqual(tokens('initial'));

    http.get(url).subscribe();
    requests.expectOne(url).flush({}, { status: 401, statusText: 'Unauthorized' });
    requests.expectOne(refreshUrl).flush(tokens('renewed'));
    requests.expectOne(url).flush({});
  });

  it('does not replay an expired request under a different browser session', () => {
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const url = '/api/v1/platform/companies/2/suspend';
    http.patch(url, {}).subscribe({ error: () => {} });
    requests.expectOne(url).flush({}, { status: 401, statusText: 'Unauthorized' });
    requests.expectOne(refreshUrl).flush(tokens('second-tab', '11'));
    requests.expectNone(url);
    expect(auth.tokens()).toBeNull();
  });

  it('waits for the API to revoke the browser session before signing out', () => {
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    auth.logout().subscribe();
    const request = requests.expectOne('/api/v1/auth/browser/logout');
    expect(request.request.body).toEqual({ sessionId: '10' });
    expect(request.request.withCredentials).toBeTrue();
    expect(auth.tokens()).toEqual(tokens('initial'));
    request.flush(null, { status: 204, statusText: 'No Content' });
    expect(auth.tokens()).toBeNull();
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/signin']);
  });

  it('writes the access token, user and session after OTP without storing a refresh credential', () => {
    auth.verify(42, '123456').subscribe();
    const verified = tokens('verified', '11');
    const expiresAt = '2030-08-01T12:00:00Z';
    requests.expectOne('/api/v1/auth/login/verify-otp').flush({
      ...verified, refreshToken: 'legacy-refresh', refreshTokenExpiresAt: expiresAt,
    });
    const saved = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY)!);
    expect(saved).toEqual({
      accessToken: verified.accessToken,
      user: { id: '1', roles: ['SUPER_ADMIN'], permissions: [] },
      session: { id: '11', accessTokenExpiresAt: new Date(4102444800 * 1000).toISOString(), expiresAt },
    });
    auth.refresh().subscribe();
    const renewed = tokens('renewed', '11');
    requests.expectOne(refreshUrl).flush(renewed);
    expect(JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY)!)).toEqual({ ...saved, accessToken: renewed.accessToken });
  });

  it('preserves the newer storage entry when another tab has signed in', () => {
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const newer = JSON.stringify({ session: { id: '99' } });
    localStorage.setItem(AUTH_STORAGE_KEY, newer);
    auth.clear();
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBe(newer);
  });
});
