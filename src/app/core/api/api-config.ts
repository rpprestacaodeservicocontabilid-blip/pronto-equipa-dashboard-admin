import { InjectionToken, inject, provideAppInitializer } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export const API_CONFIG = new InjectionToken<{ apiBaseUrl: string }>('API_CONFIG', {
  providedIn: 'root', factory: () => ({ apiBaseUrl: '/api/v1' }),
});

export function provideApiConfig() {
  return provideAppInitializer(() => {
    const config = inject(API_CONFIG);
    return firstValueFrom(inject(HttpClient).get<{ apiBaseUrl: string }>('/config.json'))
      .then(value => {
        const url = value.apiBaseUrl?.replace(/\/$/, '');
        if (!url || !(url.startsWith('/') && !url.startsWith('//') || /^https?:\/\//.test(url))) {
          throw new Error('Invalid API base URL in config.json');
        }
        config.apiBaseUrl = url;
      });
  });
}
