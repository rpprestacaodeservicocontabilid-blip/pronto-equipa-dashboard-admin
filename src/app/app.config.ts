import { ApplicationConfig, LOCALE_ID, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { activeLocale } from './core/i18n/locale';
import { Directionality } from '@angular/cdk/bidi';
import { provideRouter, withInMemoryScrolling } from '@angular/router';

import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './core/auth/auth.interceptor';
import { loadApiConfig } from './core/api/api-config';
import { AuthService } from './core/auth/auth.service';
import { LiveDirectionality } from './core/services/live-directionality.service';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: LOCALE_ID, useFactory: activeLocale },
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withInMemoryScrolling({ anchorScrolling: 'enabled' })),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAppInitializer(() => {
      const auth = inject(AuthService);
      return loadApiConfig().then(() => auth.restore());
    }),
    { provide: Directionality, useClass: LiveDirectionality },
  ],
};
