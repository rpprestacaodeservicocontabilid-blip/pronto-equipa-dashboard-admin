import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, firstValueFrom, of, shareReplay, tap, throwError } from 'rxjs';
import { AuthApiService } from '../infrastructure/auth-api.service';
import { AuthSessionStore, BrowserSessionChanged } from './auth-session.store';
import { AuthTokens, PasswordChangeInput } from '../domain/auth.models';
export * from '../domain/auth.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(AuthApiService);
  private readonly store = inject(AuthSessionStore);
  private readonly router = inject(Router);
  readonly tokens = this.store.tokens.asReadonly();
  readonly claims = this.store.claims.asReadonly();
  get revision() { return this.store.revision; }
  private readonly restoreFailed = signal(false);
  readonly sessionUnavailable = this.restoreFailed.asReadonly();
  private refreshing?: Observable<AuthTokens>;
  login(identifier: string, password: string) { return this.api.login(identifier, password); }
  verify(challengeId: number, code: string) {
    const revision = this.store.revision;
    return this.api.verifyLogin(challengeId, code).pipe(tap(tokens => this.startSession(tokens, revision)));
  }
  googleLogin(code: string) {
    const revision = this.store.revision;
    return this.api.googleLogin(code).pipe(tap(tokens => this.startSession(tokens, revision)));
  }
  resend(challengeId: number) { return this.api.resendLogin(challengeId); }
  async restore(): Promise<void> {
    const revision = this.revision;
    const cached = this.store.readSnapshot();
    try {
      await firstValueFrom(this.refresh());
      if (this.revision === revision) this.restoreFailed.set(false);
    } catch (error) {
      if (this.revision === revision) {
        const unauthorized = error instanceof HttpErrorResponse && error.status === 401;
        this.restoreFailed.set(!unauthorized);
        if (unauthorized) this.store.discardSnapshot(cached);
      }
    }
  }
  refresh(): Observable<AuthTokens> {
    if (!this.refreshing) {
      const revision = this.store.revision;
      const expected = this.claims();
      const refresh = this.api.refresh().pipe(
        tap(tokens => {
          this.assertRevision(revision);
          this.store.accept(tokens, expected);
        }),
        catchError(error => {
          if (error instanceof BrowserSessionChanged && this.revision === revision) this.clear();
          return throwError(() => error);
        }),
        finalize(() => {
          if (this.refreshing === refresh) this.refreshing = undefined;
        }),
        shareReplay({ bufferSize: 1, refCount: false }));
      this.refreshing = refresh;
    }
    return this.refreshing;
  }
  isPlatformAdmin() { return this.claims()?.roles.includes('SUPER_ADMIN') ?? false; }
  get homeUrl() { return this.isPlatformAdmin() ? '/companies' : '/contracts'; }
  logout(returnUrl?: string) {
    const revision = this.store.revision;
    const sessionId = this.claims()?.sessionId;
    const request = sessionId ? this.api.logout(sessionId) : of(undefined);
    return request.pipe(
      catchError(error => error instanceof HttpErrorResponse && error.status === 409 ? of(undefined) : throwError(() => error)),
      tap(() => { if (revision === this.store.revision) this.clear(returnUrl); }),
    );
  }
  changePassword(input: PasswordChangeInput) {
    const revision = this.revision;
    // The API revokes every session after changing the password, including this one.
    return this.api.changePassword(input).pipe(tap(() => {
      if (this.revision !== revision) return;
      this.refreshing = undefined;
      this.store.clear();
      void this.router.navigate(['/signin'], { queryParams: { reason: 'password-changed' } });
    }));
  }
  revokeSession(id: number) {
    const revision = this.revision;
    return this.api.revokeSession(id).pipe(tap(() => {
      if (this.revision === revision && String(id) === this.claims()?.sessionId) this.clear();
    }));
  }
  clear(returnUrl?: string) {
    this.refreshing = undefined;
    this.restoreFailed.set(false);
    this.store.clear();
    if (returnUrl) void this.router.navigate(['/signin'], { queryParams: { returnUrl } });
    else void this.router.navigate(['/signin']);
  }
  private startSession(tokens: AuthTokens, revision: number) {
    this.assertRevision(revision);
    this.store.accept(tokens);
    this.store.revision++;
    this.restoreFailed.set(false);
    this.refreshing = undefined;
  }
  private assertRevision(revision: number) {
    if (revision !== this.store.revision) throw new Error('This sign-in request has been cancelled.');
  }
}
