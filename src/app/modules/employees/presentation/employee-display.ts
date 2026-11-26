import { HttpErrorResponse } from '@angular/common/http';
import { apiErrorMessage } from '../../../core/api/api-error';
import { activeLocale } from '../../../core/i18n/locale';

const documentStatuses = new Map<string, () => string>([
  ['ACTIVE', () => $localize`:@@employees-document-active:Active`],
  ['PENDING_UPLOAD', () => $localize`:@@employees-pending-upload:Pending upload`],
  ['SCANNING', () => $localize`:@@employees-scanning:Scanning`],
  ['PENDING_VALIDATION', () => $localize`:@@employees-pending-validation:Pending validation`],
  ['QUARANTINED', () => $localize`:@@employees-quarantined:Quarantined`],
  ['REJECTED', () => $localize`:@@employees-rejected:Rejected`],
  ['EXPIRED', () => $localize`:@@employees-expired:Expired`],
  ['ARCHIVED', () => $localize`:@@employees-archived:Archived`],
  ['PENDING_DELETION', () => $localize`:@@employees-pending-deletion:Pending deletion`],
  ['DELETED', () => $localize`:@@employees-deleted:Deleted`],
]);

const profileOptions = new Map<string, () => string>([
  ['BI', () => $localize`:@@employees-identity-card:Identity card`],
  ['PASSPORT', () => $localize`:@@employees-passport:Passport`],
  ['RESIDENCE_PERMIT', () => $localize`:@@employees-residence-permit:Residence permit`],
  ['OTHER', () => $localize`:@@employees-other:Other`],
  ['EDUCATION', () => $localize`:@@employees-education:Education`],
  ['TRAINING', () => $localize`:@@employees-training:Training`],
  ['CERTIFICATION', () => $localize`:@@employees-certification:Certification`],
]);

const serverMessages = new Map<string, () => string>([
  ['Employee number already exists in this company.', () => $localize`:@@employees-employee-number-already-exists-in-this-company:Employee number already exists in this company.`],
  ['This section changed. Reload it before editing.', () => $localize`:@@employees-this-section-changed-reload-it-before-editing:This section changed. Reload it before editing.`],
  ['Only pending registrations can be reviewed.', () => $localize`:@@employees-only-pending-registrations-can-be-reviewed:Only pending registrations can be reviewed.`],
  ['Rejection requires a reason.', () => $localize`:@@employees-rejection-requires-a-reason:Rejection requires a reason.`],
  ['Registration changed. Reload it before continuing.', () => $localize`:@@employees-registration-changed-reload-it-before-continuing:Registration changed. Reload it before continuing.`],
  ['Only a draft can be modified or submitted.', () => $localize`:@@employees-only-a-draft-can-be-modified-or-submitted:Only a draft can be modified or submitted.`],
  ['Bank details cannot be changed for a terminated employee.', () => $localize`:@@employees-bank-details-cannot-be-changed-for-a-terminated-employee:Bank details cannot be changed for a terminated employee.`],
  ['Status effective date cannot precede the admission date.', () => $localize`:@@employees-status-effective-date-cannot-precede-the-admission-date:Status effective date cannot precede the admission date.`],
  ['Future-dated status changes are not supported.', () => $localize`:@@employees-future-dated-status-changes-are-not-supported:Future-dated status changes are not supported.`],
  ['A termination reason is required.', () => $localize`:@@employees-a-termination-reason-is-required:A termination reason is required.`],
  ['A rehire date must be after the previous termination date.', () => $localize`:@@employees-a-rehire-date-must-be-after-the-previous-termination-date:A rehire date must be after the previous termination date.`],
  ['Status history cannot be changed retroactively.', () => $localize`:@@employees-status-history-cannot-be-changed-retroactively:Status history cannot be changed retroactively.`],
  ['A terminated employee cannot be transferred.', () => $localize`:@@employees-a-terminated-employee-cannot-be-transferred:A terminated employee cannot be transferred.`],
  ['Professional effective date cannot precede the admission date.', () => $localize`:@@employees-professional-effective-date-cannot-precede-the-admission-date:Professional effective date cannot precede the admission date.`],
  ['Future-dated professional changes are not supported.', () => $localize`:@@employees-future-dated-professional-changes-are-not-supported:Future-dated professional changes are not supported.`],
  ['Professional history periods cannot overlap or be backdated.', () => $localize`:@@employees-professional-history-periods-cannot-overlap-or-be-backdated:Professional history periods cannot overlap or be backdated.`],
  ['Dependent name and relationship are required.', () => $localize`:@@employees-dependent-name-and-relationship-are-required:Dependent name and relationship are required.`],
]);

export function employeeDocumentStatus(status: string): string {
  return documentStatuses.get(status)?.() ?? status;
}

export function employeeProfileOption(option: string): string {
  return profileOptions.get(option)?.() ?? option;
}

export function employeeImportError(message: string | undefined): string {
  return (message && serverMessages.get(message)?.())
    || (message && activeLocale() === 'en' ? message : $localize`:@@employees-this-record-could-not-be-imported-check-the-employee-data:This record could not be imported. Check the employee data.`);
}

export function employeeErrorMessage(error: unknown): string {
  if (!(error instanceof HttpErrorResponse) || activeLocale() === 'en' || [0, 403, 429].includes(error.status)) {
    return apiErrorMessage(error);
  }
  const body = error.error;
  const message = typeof body?.error === 'string' ? body.error : body?.error?.message ?? body?.message;
  const known = typeof message === 'string' ? serverMessages.get(message)?.() : undefined;
  if (known) return known;
  switch (error.status) {
    case 400:
    case 422: return $localize`:@@employees-enter-valid-employee-details-and-try-again:Enter valid employee details and try again.`;
    case 404: return $localize`:@@employees-the-requested-employee-record-was-not-found:The requested employee record was not found.`;
    case 409: return $localize`:@@employees-the-employee-record-was-changed-or-conflicts-with-another-record:The employee record was changed or conflicts with another record.`;
    default: return $localize`:@@employees-the-employee-request-could-not-be-completed-try-again:The employee request could not be completed. Try again.`;
  }
}
