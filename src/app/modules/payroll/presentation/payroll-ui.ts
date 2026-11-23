import { Signal, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { Observable, catchError, map, of, startWith, switchMap } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { apiErrorMessage } from '../../../core/api/api-error';

export type PayrollLoad<T> = { data: T } | { error: string } | null;

export function payrollQuery<Q, T>(query: Signal<Q>, load: (value: Q) => Observable<T>) {
  return toSignal(toObservable(query).pipe(
    switchMap(value => load(value).pipe(
      map(data => ({ data })),
      catchError(error => of({ error: apiErrorMessage(error) })),
      startWith(null),
    )),
  ), { initialValue: null });
}

export function payrollConflict(error: unknown) {
  return error instanceof HttpErrorResponse && error.status === 409;
}

export function payrollQueryParam(name: string) {
  return toSignal(inject(ActivatedRoute).queryParamMap.pipe(map(params => params.get(name) ?? '')), { requireSync: true });
}

export class SubmissionKey {
  private request?: { signature: string; key: string };

  for(input: object) {
    const signature = JSON.stringify(input);
    if (this.request?.signature !== signature) this.request = { signature, key: crypto.randomUUID() };
    return this.request.key;
  }

  clear() { this.request = undefined; }
}
