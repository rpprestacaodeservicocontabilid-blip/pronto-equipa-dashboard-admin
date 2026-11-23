import { HttpErrorResponse } from '@angular/common/http';

export function apiErrorMessage(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) return error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.';
  if (error.status === 0) return 'Unable to connect to PRONTOEQUIPAS. Check the API connection.';
  if (error.status === 403) return 'You do not have permission to perform this action.';
  if (error.status === 429) return 'Too many attempts. Please wait before trying again.';
  const body = error.error;
  return (typeof body?.error === 'string' ? body.error : body?.error?.message)
    || body?.message || 'The request could not be completed. Please try again.';
}
