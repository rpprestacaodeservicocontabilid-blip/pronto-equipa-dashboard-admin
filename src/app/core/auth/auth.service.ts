import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, finalize, shareReplay, tap } from 'rxjs';
import { API_CONFIG } from '../api/api-config';

export interface LoginChallenge {
  otpRequired: true;
  challengeId: number;
  destination: string;
  expiresAt: string;
}
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
}
interface Claims { sub: string; roles: string[]; permissions: string[]; }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(API_CONFIG);
  private readonly router = inject(Router);
  // Tokens remain in memory. Reloading requires signing in again.
  readonly tokens = signal<AuthTokens | null>(null);
  readonly claims = signal<Claims | null>(null);
  private refreshing?: Observable<AuthTokens>;

  login(identifier: string, password: string) {
    return this.http.post<LoginChallenge>(`${this.config.apiBaseUrl}/auth/login`, { identifier, password });
  }

  verify(challengeId: number, code: string) {
    return this.http.post<AuthTokens>(`${this.config.apiBaseUrl}/auth/login/verify-otp`, { challengeId, code })
      .pipe(tap(tokens => this.accept(tokens)));
  }

  resend(challengeId: number) {
    return this.http.post<LoginChallenge>(`${this.config.apiBaseUrl}/auth/login/resend-otp`, { challengeId });
  }

  refresh(): Observable<AuthTokens> {
    if (!this.refreshing) {
      this.refreshing = this.http.post<AuthTokens>(`${this.config.apiBaseUrl}/auth/refresh`, {
        refreshToken: this.tokens()?.refreshToken,
      }).pipe(tap(tokens => this.accept(tokens)), finalize(() => this.refreshing = undefined),
        shareReplay({ bufferSize: 1, refCount: false }));
    }
    return this.refreshing;
  }

  isPlatformAdmin(): boolean { return this.claims()?.roles.includes('SUPER_ADMIN') ?? false; }

  logout() {
    return this.http.post(`${this.config.apiBaseUrl}/auth/logout`, {}).pipe(finalize(() => this.clear()));
  }

  clear() {
    this.tokens.set(null);
    this.claims.set(null);
    void this.router.navigate(['/signin']);
  }

  private accept(tokens: AuthTokens) {
    const encoded = tokens.accessToken.split('.')[1];
    const decoded: unknown = JSON.parse(atob(encoded.replace(/-/g, '+').replace(/_/g, '/')));
    const claims = decoded as Claims;
    if (!claims.sub || !Array.isArray(claims.roles) || !Array.isArray(claims.permissions)) {
      throw new Error('Invalid authentication response');
    }
    this.claims.set(claims);
    this.tokens.set(tokens);
  }
}
