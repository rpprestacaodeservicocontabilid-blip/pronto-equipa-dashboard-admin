import { HttpErrorResponse } from '@angular/common/http';
import { apiErrorMessage } from '../../../core/api/api-error';
import { activeLocale } from '../../../core/i18n/locale';
import { organizationKnownError } from './organization-api-labels';

const options = new Map<string, string>([
  ['ACTIVE', $localize`:@@organization-active:Active`],
  ['INACTIVE', $localize`:@@organization-inactive:Inactive`],
  ['PRIMARY', $localize`:@@organization-primary:Primary`],
  ['SECONDARY', $localize`:@@organization-secondary:Secondary`],
  ['DEPARTMENT', $localize`:@@organization-department:Department`],
  ['ESTABLISHMENT', $localize`:@@organization-establishment:Establishment`],
  ['EMPLOYEE', $localize`:@@organization-employee:Employee`],
  ['HOLIDAY', $localize`:@@organization-holiday:Holiday`],
  ['REST_DAY', $localize`:@@organization-rest-day:Rest day`],
  ['WORKING_DAY', $localize`:@@organization-working-day:Working day`],
  ['SPECIAL', $localize`:@@organization-special:Special`],
  ['SUCCESS', $localize`:@@organization-success:Success`],
  ['FAILED', $localize`:@@organization-failed:Failed`],
  ['FAILURE', $localize`:@@organization-failed:Failed`],
  ['DENIED', $localize`:@@organization-denied:Denied`],
  ['PARTIAL', $localize`:@@organization-partial:Partial`],
  ['CANCELLED', $localize`:@@organization-cancelled:Cancelled`],
  ['Primary assignment', $localize`:@@organization-primary-assignment:Primary assignment`],
  ['Secondary assignment', $localize`:@@organization-secondary-assignment:Secondary assignment`],
]);

export function organizationOptionLabel(value: unknown): string {
  return typeof value === 'string' ? options.get(value) ?? value : '—';
}

export function organizationErrorMessage(error: unknown): string {
  if (!(error instanceof HttpErrorResponse) || activeLocale() === 'en' || [0, 403, 429].includes(error.status)) {
    return apiErrorMessage(error);
  }
  const known = organizationKnownError(error);
  if (known) return known;
  switch (error.status) {
    case 400:
    case 422: return $localize`:@@organization-check-the-organization-details-and-try-again:Check the organization details and try again.`;
    case 404: return $localize`:@@organization-the-requested-organization-record-was-not-found:The requested organization record was not found.`;
    case 409: return $localize`:@@organization-the-organization-record-has-changed-or-conflicts-with-another-record:The organization record has changed or conflicts with another record.`;
    default: return $localize`:@@organization-the-organization-request-could-not-be-completed-try-again:The organization request could not be completed. Try again.`;
  }
}
