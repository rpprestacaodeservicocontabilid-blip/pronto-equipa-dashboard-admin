import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService, AuthTokens } from './auth.service';
import { authInterceptor } from './auth.interceptor';

describe('Platform API authentication', () => {
  let http: HttpClient;
  let requests: HttpTestingController;
  let auth: AuthService;
  const tokens = (name: string): AuthTokens => ({
    accessToken: `header.${btoa(JSON.stringify({ sub: '1', roles: ['SUPER_ADMIN'], permissions: [], name }))}.signature`,
    refreshToken: `refresh-${name}`, accessTokenExpiresAt: '', refreshTokenExpiresAt: '',
  });
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      provideRouter([]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(),
    ] });
    http = TestBed.inject(HttpClient);
    requests = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    auth.tokens.set(tokens('initial'));
  });
  afterEach(() => requests.verify());

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
    requests.expectNone('/api/v1/auth/refresh');
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
    const refresh = requests.expectOne('/api/v1/auth/refresh');
    expect(refresh.request.body).toEqual({ refreshToken: 'refresh-initial' });
    expect(refresh.request.headers.has('Authorization')).toBeFalse();
    refresh.flush(tokens('new'));
    for (const page of [1, 2]) {
      const retry = requests.expectOne(`/api/v1/platform/companies?page=${page}`);
      expect(retry.request.headers.get('Authorization')).toBe(`Bearer ${tokens('new').accessToken}`);
      retry.flush({});
    }
    expect(completed).toBe(2);
  });
});
