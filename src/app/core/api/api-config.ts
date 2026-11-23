import { InjectionToken, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';

export interface ApiConfig {
  apiBaseUrl: string;
  googleOAuth?: { clientId: string; redirectUri: string };
}
export const API_CONFIG = new InjectionToken<ApiConfig>('API_CONFIG', {
  providedIn: 'root', factory: () => ({ apiBaseUrl: '/api/v1' }),
});

export function loadApiConfig() {
  const config = inject(API_CONFIG);
  return firstValueFrom(inject(HttpClient).get<ApiConfig>('/config.json').pipe(timeout(5000)))
      .then(value => {
        const url = value?.apiBaseUrl?.replace(/\/$/, '');
        if (url && (url.startsWith('/') && !url.startsWith('//') || /^https?:\/\//.test(url))) {
          config.apiBaseUrl = url;
        }
        if (value?.googleOAuth?.clientId) {
          const redirect = new URL(value.googleOAuth.redirectUri);
          if (redirect.origin === window.location.origin && redirect.pathname === '/oauth/callback') {
            config.googleOAuth = value.googleOAuth;
          }
        }
      })
      .catch(error => console.warn('Using the available API configuration.', error));
}
