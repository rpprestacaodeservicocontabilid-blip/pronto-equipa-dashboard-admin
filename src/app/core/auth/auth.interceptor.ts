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
  const publicAuth = request.url.startsWith(`${base}/auth/`) && request.url !== `${base}/auth/logout`;
  if (publicAuth || !auth.tokens()) return next(request);
  const token = auth.tokens()!.accessToken;
  const authenticated = request.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  return next(authenticated).pipe(catchError((error: unknown) => {
    if (!(error instanceof HttpErrorResponse) || error.status !== 401) return throwError(() => error);
    const current = auth.tokens();
    if (!current) return throwError(() => error);
    // Another request may already have rotated this token while this request was in flight.
    if (current.accessToken !== token) {
      return next(request.clone({ setHeaders: { Authorization: `Bearer ${current.accessToken}` } }));
    }
    return auth.refresh().pipe(
      catchError(refreshError => { auth.clear(); return throwError(() => refreshError); }),
      switchMap(tokens => next(request.clone({ setHeaders: { Authorization: `Bearer ${tokens.accessToken}` } }))),
      catchError(retryError => {
        if (retryError instanceof HttpErrorResponse && retryError.status === 401) auth.clear();
        return throwError(() => retryError);
      }),
    );
  }));
};
