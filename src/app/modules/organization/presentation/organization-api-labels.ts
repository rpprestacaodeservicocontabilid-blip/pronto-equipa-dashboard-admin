import { HttpErrorResponse } from '@angular/common/http';

const resources = new Map<string, () => string>([
  ['DEPARTMENT', () => $localize`:@@organization-department:Department`],
  ['JOB_FUNCTION', () => $localize`:@@organization-job-function:Job function`],
  ['JOB_POSITION', () => $localize`:@@organization-job-position:Job position`],
  ['PROFESSIONAL_CATEGORY', () => $localize`:@@organization-professional-category:Professional category`],
  ['COST_CENTER', () => $localize`:@@organization-cost-center:Cost center`],
  ['COST_ALLOCATION', () => $localize`:@@organization-cost-allocation:Cost allocation`],
  ['COST_ALLOCATION_BATCH', () => $localize`:@@organization-cost-allocations:Cost allocations`],
  ['ESTABLISHMENT', () => $localize`:@@organization-establishment:Establishment`],
  ['WORK_CALENDAR', () => $localize`:@@organization-work-calendar:Work calendar`],
  ['CALENDAR', () => $localize`:@@organization-work-calendar:Work calendar`],
  ['CALENDAR_EXCEPTION', () => $localize`:@@organization-calendar-exception:Calendar exception`],
  ['WORK_SCHEDULE', () => $localize`:@@organization-work-schedule:Work schedule`],
  ['SCHEDULE', () => $localize`:@@organization-work-schedule:Work schedule`],
  ['WORK_SHIFT', () => $localize`:@@organization-work-shift:Work shift`],
  ['SHIFT', () => $localize`:@@organization-work-shift:Work shift`],
  ['SCHEDULE_ASSIGNMENT', () => $localize`:@@organization-schedule-assignment:Schedule assignment`],
  ['DEPARTMENT_ASSIGNMENT', () => $localize`:@@organization-department-assignment:Department assignment`],
]);

const actions = new Map<string, () => string>([
  ['created', () => $localize`:@@organization-creation:Creation`],
  ['updated', () => $localize`:@@organization-update:Update`],
  ['active', () => $localize`:@@organization-activation:Activation`],
  ['activated', () => $localize`:@@organization-activation:Activation`],
  ['inactive', () => $localize`:@@organization-deactivation:Deactivation`],
  ['deactivated', () => $localize`:@@organization-deactivation:Deactivation`],
  ['moved', () => $localize`:@@organization-move-in-hierarchy:Move in hierarchy`],
]);

const knownErrors = new Map<string, () => string>([
  ['Code already exists for this organizational resource.', () => $localize`:@@organization-the-code-is-already-in-use-for-this-resource:The code is already in use for this resource.`],
  ['Department hierarchy cannot contain a cycle.', () => $localize`:@@organization-the-department-cannot-be-moved-under-itself-or-one-of-its-subdepartments:The department cannot be moved under itself or one of its subdepartments.`],
  ['Organization record was changed concurrently.', () => $localize`:@@organization-another-operation-changed-the-record-reload-it-and-try-again:Another operation changed the record. Reload it and try again.`],
  ['Department was changed concurrently.', () => $localize`:@@organization-another-operation-changed-the-record-reload-it-and-try-again:Another operation changed the record. Reload it and try again.`],
  ['Effective periods cannot overlap for the same organizational scope.', () => $localize`:@@organization-effective-periods-cannot-overlap-for-the-same-organizational-scope:Effective periods cannot overlap for the same organizational scope.`],
  ['Cost allocations cannot overlap an existing effective period.', () => $localize`:@@organization-cost-allocations-cannot-overlap-an-existing-effective-period:Cost allocations cannot overlap an existing effective period.`],
  ['An employee cannot have overlapping primary department assignments.', () => $localize`:@@organization-an-employee-cannot-have-overlapping-primary-department-assignments:An employee cannot have overlapping primary department assignments.`],
  ['Resource has active child records that must be reassigned first.', () => $localize`:@@organization-reassign-active-child-records-before-deactivating-this-record:Reassign active child records before deactivating this record.`],
  ['Active employees must be reassigned before deactivating the department.', () => $localize`:@@organization-reassign-active-employees-before-deactivating-the-department:Reassign active employees before deactivating the department.`],
  ['Active cost allocations must be reassigned before deactivation.', () => $localize`:@@organization-reassign-active-cost-allocations-before-deactivating-the-cost-center:Reassign active cost allocations before deactivating the cost center.`],
  ['Schedule assignments must be ended before deactivating the schedule.', () => $localize`:@@organization-end-the-schedule-assignments-before-deactivating-the-schedule:End the schedule assignments before deactivating the schedule.`],
  ['Departments must be reassigned before deactivating the establishment.', () => $localize`:@@organization-reassign-departments-before-deactivating-the-establishment:Reassign departments before deactivating the establishment.`],
  ['Effective organizational records cannot be changed retroactively.', () => $localize`:@@organization-the-effective-record-cannot-be-changed-retroactively:The effective record cannot be changed retroactively.`],
  ['Cost allocations must be ended by changing their effective period, not deactivated.', () => $localize`:@@organization-end-the-cost-allocation-by-changing-its-effective-period:End the cost allocation by changing its effective period.`],
]);

export function organizationAuditResource(type: string): string {
  return resources.get(type.toUpperCase().replaceAll('-', '_'))?.() ?? type;
}

export function organizationAuditAction(code: string): string {
  const [module, resource, action, ...rest] = code.split('.');
  if (module !== 'organization' || !resource || !action || rest.length) return code;
  const label = actions.get(action);
  if (!label) return code;
  return organizationAuditResource(resource) + ' · ' + label();
}

export function organizationKnownError(error: HttpErrorResponse): string | undefined {
  const body = error.error;
  const message = typeof body?.error === 'string' ? body.error : body?.error?.message ?? body?.message;
  return typeof message === 'string' ? knownErrors.get(message)?.() : undefined;
}
