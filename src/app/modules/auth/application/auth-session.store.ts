import { DOCUMENT, Injectable, inject, signal } from '@angular/core';
import { AuthClaims, AuthTokens } from '../domain/auth.models';

export const AUTH_STORAGE_KEY = 'prontoequipas.auth.session';
export class BrowserSessionChanged extends Error {}

interface BrowserSessionSnapshot {
  accessToken: string;
  user: { id: string; roles: string[]; permissions: string[] };
  session: { id: string; accessTokenExpiresAt: string; expiresAt?: string };
}

@Injectable({ providedIn: 'root' })
export class AuthSessionStore {
  private readonly document = inject(DOCUMENT);
  // The API keeps the refresh credential in an HttpOnly cookie.
  readonly tokens = signal<AuthTokens | null>(null);
  readonly claims = signal<AuthClaims | null>(null);
  revision = 0;
  accept(tokens: AuthTokens, expected?: AuthClaims | null) {
    const encoded = tokens.accessToken.split('.')[1];
    const bytes = Uint8Array.from(atob(encoded.replace(/-/g, '+').replace(/_/g, '/')), value => value.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as AuthClaims;
    const accessExpiry = new Date(claims.exp * 1000);
    if (!claims.sub || !claims.sessionId || !Array.isArray(claims.roles) || !Array.isArray(claims.permissions)
      || claims.type !== 'access' || !Number.isFinite(claims.exp) || !Number.isFinite(accessExpiry.getTime())) {
      throw new Error('Invalid authentication response.');
    }
    if (expected && (claims.sub !== expected.sub || claims.sessionId !== expected.sessionId)) {
      throw new BrowserSessionChanged('Your browser session has changed. Sign in again.');
    }
    this.tokens.set(tokens);
    this.claims.set(claims);
    this.persist(tokens, claims, accessExpiry.toISOString());
  }

  clear() {
    const sessionId = this.claims()?.sessionId;
    this.revision++;
    this.tokens.set(null);
    this.claims.set(null);
    const snapshot = this.readSnapshot();
    if (sessionId && this.parseSnapshot(snapshot)?.session?.id === sessionId) this.discardSnapshot(snapshot);
  }

  readSnapshot(): string | null {
    try {
      return this.document.defaultView?.localStorage.getItem(AUTH_STORAGE_KEY) ?? null;
    } catch { return null; }
  }

  discardSnapshot(snapshot: string | null) {
    if (!snapshot) return;
    try {
      const storage = this.document.defaultView?.localStorage;
      if (storage?.getItem(AUTH_STORAGE_KEY) === snapshot) storage.removeItem(AUTH_STORAGE_KEY);
    } catch { /* Storage may be blocked by the browser. */ }
  }

  private persist(tokens: AuthTokens, claims: AuthClaims, accessTokenExpiresAt: string) {
    const previous = this.parseSnapshot(this.readSnapshot());
    const expiresAt = tokens.refreshTokenExpiresAt
      ?? (previous?.session?.id === claims.sessionId ? previous.session.expiresAt : undefined);
    const snapshot: BrowserSessionSnapshot = {
      accessToken: tokens.accessToken,
      user: { id: claims.sub, roles: claims.roles, permissions: claims.permissions },
      session: { id: claims.sessionId, accessTokenExpiresAt, expiresAt },
    };
    try {
      this.document.defaultView?.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(snapshot));
    } catch { /* Cookie-based restoration still works when storage is unavailable. */ }
  }

  private parseSnapshot(value: string | null): BrowserSessionSnapshot | null {
    try {
      return value ? JSON.parse(value) as BrowserSessionSnapshot : null;
    } catch { return null; }
  }
}
