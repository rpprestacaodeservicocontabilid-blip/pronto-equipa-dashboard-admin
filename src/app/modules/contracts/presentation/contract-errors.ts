import { HttpErrorResponse } from '@angular/common/http';
import { apiErrorMessage } from '../../../core/api/api-error';
import { activeLocale } from '../../../core/i18n/locale';

function responseMessage(error: HttpErrorResponse): string {
  const body = error.error;
  const message = typeof body?.error === 'string' ? body.error : body?.error?.message ?? body?.message;
  return typeof message === 'string' ? message : '';
}

const contractErrors = new Map<string, () => string>([
  ['The contract creator cannot approve the same contract.', () => $localize`:@@contracts-the-contract-creator-cannot-approve-the-same-contract:The contract creator cannot approve the same contract.`],
  ['Contract number already exists in this company.', () => $localize`:@@contracts-contract-number-already-exists-in-this-company:Contract number already exists in this company.`],
  ['An incompatible contract already overlaps this period.', () => $localize`:@@contracts-an-incompatible-contract-already-overlaps-this-period:An incompatible contract already overlaps this period.`],
  ['Maximum contract renewals reached.', () => $localize`:@@contracts-maximum-contract-renewals-reached:Maximum contract renewals reached.`],
  ['Contract type code already exists in this company.', () => $localize`:@@contracts-contract-type-code-already-exists-in-this-company:Contract type code already exists in this company.`],
  ['Contract type is inactive or unavailable.', () => $localize`:@@contracts-contract-type-is-inactive-or-unavailable:Contract type is inactive or unavailable.`],
  ['An expired contract cannot be activated.', () => $localize`:@@contracts-an-expired-contract-cannot-be-activated:An expired contract cannot be activated.`],
  ['A contract cannot be activated before its start date.', () => $localize`:@@contracts-a-contract-cannot-be-activated-before-its-start-date:A contract cannot be activated before its start date.`],
  ['This contract type requires an end date.', () => $localize`:@@contracts-this-contract-type-requires-an-end-date:This contract type requires an end date.`],
]);

export function isContractVersionConflict(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === 409
    && /version|modified|reload|changed by another operation/i.test(responseMessage(error));
}

export function contractErrorMessage(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) return apiErrorMessage(error);
  if (isContractVersionConflict(error)) return $localize`:@@contracts-the-contract-was-changed-by-another-operation-reload-it-and-try-again:The contract was changed by another operation. Reload it and try again.`;
  const knownError = contractErrors.get(responseMessage(error));
  if (knownError) return knownError();
  if (activeLocale() === 'en' || [0, 403, 429].includes(error.status)) return apiErrorMessage(error);

  switch (error.status) {
    case 400:
    case 422: return $localize`:@@contracts-check-the-contract-details-and-try-again:Check the contract details and try again.`;
    case 404: return $localize`:@@contracts-the-requested-record-could-not-be-found:The requested record could not be found.`;
    case 409: return $localize`:@@contracts-the-contract-operation-conflicts-with-the-current-state:The contract operation conflicts with the current state.`;
    default: return $localize`:@@contracts-could-not-complete-the-contract-request-try-again:Could not complete the contract request. Try again.`;
  }
}
