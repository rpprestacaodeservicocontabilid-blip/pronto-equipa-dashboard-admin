import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { Directionality } from '@angular/cdk/bidi';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './core/auth/auth.interceptor';
import { provideApiConfig } from './core/api/api-config';
import { LiveDirectionality } from './core/services/live-directionality.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideApiConfig(),
    { provide: Directionality, useClass: LiveDirectionality },
  ],
};
