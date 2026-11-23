import { DOCUMENT, InjectionToken, Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, defer, firstValueFrom, from, map } from 'rxjs';
import { API_CONFIG } from '../../../core/api/api-config';
import { AuthTokens, AuthSession, LoginChallenge, RegisterInput, RegisterResult,
  VerificationResult, VerifyEmailInput, PasswordResetInput, PasswordChangeInput } from '../domain/auth.models';

type BrowserSessionWrite = <T>(scope: string, action: () => Observable<T>) => Observable<T>;
export const BROWSER_SESSION_WRITE = new InjectionToken<BrowserSessionWrite>('Browser session write', {
  providedIn: 'root',
  factory: () => {
    const window = inject(DOCUMENT).defaultView;
    // Serialize only requests that change the shared cookie across browser tabs.
    return (scope, action) => defer(() => {
      const locks = window?.navigator.locks;
      return locks ? from(locks.request('prontoequipas.auth:' + scope, () => firstValueFrom(action()))) : action();
    });
  },
});
const browserSession = { withCredentials: true, headers: { 'X-Pronto-Session': 'browser' }, timeout: 12000 };

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(API_CONFIG);
  private readonly sessionWrite = inject(BROWSER_SESSION_WRITE);
  private get base() { return this.config.apiBaseUrl; }
  login(identifier: string, password: string) {
    return this.http.post<LoginChallenge>(`${this.base}/auth/login`, { identifier, password });
  }
  verifyLogin(challengeId: number, code: string) {
    return this.sessionWrite(this.base, () =>
      this.http.post<AuthTokens>(`${this.base}/auth/login/verify-otp`, { challengeId, code }, browserSession));
  }
  resendLogin(challengeId: number) {
    return this.http.post<LoginChallenge>(`${this.base}/auth/login/resend-otp`, { challengeId });
  }
  register(input: RegisterInput) {
    // The legacy public API requires a non-administrative account type.
    return this.http.post<RegisterResult>(`${this.base}/auth/register`, { ...input, accountType: 'ORGANIZER' });
  }
  verifyEmail(input: VerifyEmailInput) { return this.http.post<void>(`${this.base}/auth/verify-email`, input); }
  resendVerification(email: string) {
    return this.http.post<VerificationResult>(`${this.base}/auth/resend-verification`, { email });
  }
  forgotPassword(email: string) { return this.http.post<void>(`${this.base}/auth/forgot-password`, { email }); }
  resetPassword(input: PasswordResetInput) { return this.http.post<void>(`${this.base}/auth/reset-password`, input); }
  changePassword(input: PasswordChangeInput) { return this.http.post<void>(`${this.base}/auth/change-password`, input); }
  refresh() {
    return this.http.post<AuthTokens | null>(`${this.base}/auth/browser/refresh`, {}, browserSession).pipe(map(result => {
      if (!result) throw new HttpErrorResponse({ status: 401, statusText: 'No active browser session' });
      return result;
    }));
  }
  logout(sessionId: string) {
    return this.sessionWrite(this.base, () =>
      this.http.post<void>(`${this.base}/auth/browser/logout`, { sessionId }, browserSession));
  }
  currentSession() { return this.http.get<AuthSession>(`${this.base}/sessions/current`); }
  revokeSession(id: number) { return this.http.delete<void>(`${this.base}/sessions/${id}`); }
  revokeOtherSessions() { return this.http.delete<void>(`${this.base}/sessions`); }
  googleLogin(code: string) {
    return this.sessionWrite(this.base, () => this.http.post<AuthTokens>(`${this.base}/oauth/google`, { code }, browserSession));
  }
  linkGoogle(code: string) { return this.http.post<void>(`${this.base}/oauth/google/link`, { code }); }
  unlinkGoogle() { return this.http.delete<void>(`${this.base}/oauth/google/unlink`); }
  checkPermission(userId: number, permission: string) {
    return this.http.get<{ allowed: boolean }>(`${this.base}/authorization/users/${userId}/permissions/${encodeURIComponent(permission)}`);
  }
}
