import { HttpErrorResponse } from '@angular/common/http';

export function apiErrorMessage(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) return error instanceof Error ? error.message : $localize`:@@auth-message-8:An unexpected error occurred. Please try again.`;
  if (error.status === 0) return $localize`:@@auth-message-9:Unable to connect to PRONTOEQUIPAS. Check the API connection.`;
  if (error.status === 403) return $localize`:@@auth-message-10:You do not have permission to perform this action.`;
  if (error.status === 429) return $localize`:@@auth-message-11:Too many attempts. Please wait before trying again.`;
  const body = error.error;
  return (typeof body?.error === 'string' ? body.error : body?.error?.message)
    || body?.message || $localize`:@@auth-message-12:The request could not be completed. Please try again.`;
}
