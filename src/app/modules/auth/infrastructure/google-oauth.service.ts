import { Injectable, inject } from '@angular/core';
import { API_CONFIG } from '../../../core/api/api-config';

@Injectable({ providedIn: 'root' })
export class GoogleOAuthService {
  private readonly config = inject(API_CONFIG);
  private pending = false;
  get enabled() { return Boolean(this.config.googleOAuth?.clientId); }
  authorize(): Promise<string> {
    if (this.pending) return Promise.reject(new Error('A Google sign-in window is already open.'));
    const config = this.config.googleOAuth;
    if (!config?.clientId) return Promise.reject(new Error('Google sign-in is not configured.'));
    const state = crypto.randomUUID();
    const params = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri,
      response_type: 'code', scope: 'openid email profile', state, prompt: 'select_account' });
    const popup = window.open(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 'prontoequipas-google', 'popup,width=520,height=680');
    if (!popup) return Promise.reject(new Error('Allow popups to sign in with Google.'));
    this.pending = true;
    return new Promise((resolve, reject) => {
      const clean = () => {
        this.pending = false;
        window.removeEventListener('message', receive);
        window.clearInterval(closed); window.clearTimeout(timeout);
        popup.close();
      };
      const receive = (event: MessageEvent<unknown>) => {
        if (event.origin !== window.location.origin || event.source !== popup) return;
        const data = event.data as { type?: string; state?: string; code?: string; error?: string } | null;
        if (!data || data.type !== 'prontoequipas-google' || data.state !== state) return;
        clean();
        if (data.error || !data.code) reject(new Error('Google sign-in was cancelled or declined.'));
        else resolve(data.code);
      };
      const closed = window.setInterval(() => {
        if (popup.closed) { clean(); reject(new Error('Google sign-in window was closed.')); }
      }, 500);
      const timeout = window.setTimeout(() => { clean(); reject(new Error('Google sign-in timed out.')); }, 180000);
      window.addEventListener('message', receive);
    });
  }
}
