import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { API_CONFIG } from '../api/api-config';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const base = inject(API_CONFIG).apiBaseUrl;
  // Never send tokens to assets, unrelated servers, or public authentication endpoints.
  if (!request.url.startsWith(`${base}/`)) return next(request);
  const path = request.url.slice(base.length).split('?')[0];
  const publicAuth = (path.startsWith('/auth/') && !['/auth/logout', '/auth/change-password'].includes(path))
    || path === '/oauth/google';
  const token = auth.tokens()?.accessToken;
  if (publicAuth || !token) return next(request);
  const revision = auth.revision;
  const send = (accessToken: string) => next(request.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } }));
  const clearOnUnauthorized = (error: unknown) => {
    if (error instanceof HttpErrorResponse && error.status === 401 && auth.revision === revision) auth.clear();
    return throwError(() => error);
  };

  return send(token).pipe(catchError((error: unknown) => {
    if (!(error instanceof HttpErrorResponse) || error.status !== 401) return throwError(() => error);
    // Do not replay a previous user's request under a newly authenticated identity.
    if (auth.revision !== revision) return throwError(() => error);
    const current = auth.tokens();
    if (!current) return throwError(() => error);
    // Another request may already have rotated this token while this request was in flight.
    if (current.accessToken !== token) {
      return send(current.accessToken).pipe(catchError(clearOnUnauthorized));
    }
    return auth.refresh().pipe(
      switchMap(tokens => auth.revision === revision ? send(tokens.accessToken) : throwError(() => error)),
      catchError(clearOnUnauthorized),
    );
  }));
};
