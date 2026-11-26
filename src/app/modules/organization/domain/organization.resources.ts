import { Resource } from './organization.models';

export interface Field {
  key: string;
  label: string;
  kind: 'text' | 'textarea' | 'integer' | 'date' | 'email' | 'select' | 'reference' | 'weekdays' | 'lines';
  required?: boolean;
  max?: number;
  choices?: readonly { value: string; label: string }[];
  source?: Resource | 'employees';
  topLevel?: boolean;
}

interface ResourceConfig {
  label: string;
  fields: Field[];
  grant: string;
  dated?: boolean;
}

const establishment: Field = { kind: 'reference', key: 'establishmentId', label: $localize`:@@organization-establishment:Establishment`, source: 'establishments' };
const department: Field = { kind: 'reference', key: 'departmentId', label: $localize`:@@organization-department:Department`, source: 'departments' };
const legalVersion: Field = { kind: 'text', key: 'legalRuleVersionId', label: $localize`:@@organization-legal-rule-version-id:Legal rule version ID`, max: 120 };
const description = (max = 1000): Field => ({ kind: 'textarea', key: 'description', label: $localize`:@@organization-description:Description`, max });
const level: Field = { kind: 'integer', key: 'hierarchicalLevel', label: $localize`:@@organization-hierarchy-level:Hierarchy level`, max: 100 };

export const ORGANIZATION_RESOURCES: Record<Resource, ResourceConfig> = {
  departments: {
    label: $localize`:@@organization-departments:Departments`, grant: 'departments:update', fields: [
      description(), establishment, { kind: 'reference', key: 'managerEmployeeId', label: $localize`:@@organization-manager:Manager`, source: 'employees' },
    ],
  },
  'job-functions': {
    label: $localize`:@@organization-job-functions:Job functions`, grant: 'functions:manage', fields: [
      { kind: 'reference', key: 'relatedId', label: $localize`:@@organization-professional-category:Professional category`, source: 'professional-categories', topLevel: true },
      description(2000), { kind: 'textarea', key: 'responsibilities', label: $localize`:@@organization-responsibilities:Responsibilities`, max: 2000 },
      { kind: 'lines', key: 'requirements', label: $localize`:@@organization-qualifications-and-requirements-one-per-line:Qualifications and requirements (one per line)`, max: 250 }, level,
    ],
  },
  'job-positions': {
    label: $localize`:@@organization-job-positions:Job positions`, grant: 'positions:manage', fields: [
      { kind: 'reference', key: 'relatedId', label: $localize`:@@organization-job-function:Job function`, source: 'job-functions', topLevel: true, required: true },
      department, level, description(),
    ],
  },
  'professional-categories': {
    label: $localize`:@@organization-professional-categories:Professional categories`, grant: 'categories:manage', fields: [
      { kind: 'text', key: 'classification', label: $localize`:@@organization-classification:Classification`, max: 100 }, description(),
    ],
  },
  'cost-centers': {
    label: $localize`:@@organization-cost-centers:Cost centers`, grant: 'cost-centers:manage', fields: [
      { kind: 'reference', key: 'parentId', label: $localize`:@@organization-parent-cost-center:Parent cost center`, source: 'cost-centers', topLevel: true },
      establishment, description(),
    ],
  },
  'cost-allocations': { label: $localize`:@@organization-cost-allocations:Cost allocations`, grant: 'cost-allocations:manage', fields: [] },
  establishments: {
    label: $localize`:@@organization-establishments:Establishments`, grant: 'establishments:manage', fields: [
      { kind: 'select', key: 'establishmentType', label: $localize`:@@organization-establishment-type:Establishment type`, required: true, choices: [
        { value: 'HEADQUARTERS', label: $localize`:@@organization-headquarters:Headquarters` }, { value: 'BRANCH', label: $localize`:@@organization-branch:Branch` },
        { value: 'DELEGATION', label: $localize`:@@organization-delegation:Delegation` }, { value: 'OPERATIONAL_SITE', label: $localize`:@@organization-operational-site:Operational site` },
      ] },
      { kind: 'text', key: 'province', label: $localize`:@@organization-province:Province`, required: true, max: 100 },
      { kind: 'text', key: 'municipality', label: $localize`:@@organization-municipality:Municipality`, required: true, max: 100 },
      { kind: 'text', key: 'address', label: $localize`:@@organization-address:Address`, max: 500 },
      { kind: 'email', key: 'email', label: $localize`:@@organization-email:Email`, max: 255 },
      { kind: 'text', key: 'phone', label: $localize`:@@organization-phone:Phone`, max: 40 },
      { kind: 'reference', key: 'responsibleEmployeeId', label: $localize`:@@organization-responsible-employee:Responsible employee`, source: 'employees' },
      { kind: 'date', key: 'openedAt', label: $localize`:@@organization-opening-date:Opening date` },
      { kind: 'date', key: 'closedAt', label: $localize`:@@organization-closing-date:Closing date` },
    ],
  },
  calendars: {
    label: $localize`:@@organization-work-calendars:Work calendars`, grant: 'calendars:manage', dated: true, fields: [
      establishment, { kind: 'weekdays', key: 'workingWeekdays', label: $localize`:@@organization-working-days:Working days`, required: true },
      legalVersion, description(),
    ],
  },
  schedules: {
    label: $localize`:@@organization-work-schedules:Work schedules`, grant: 'schedules:manage', dated: true, fields: [
      { kind: 'select', key: 'scheduleType', label: $localize`:@@organization-schedule-type:Schedule type`, required: true, choices: [
        { value: 'FIXED', label: $localize`:@@organization-fixed:Fixed` }, { value: 'VARIABLE', label: $localize`:@@organization-variable:Variable` }, { value: 'SHIFT', label: $localize`:@@organization-shift-based:Shift-based` },
      ] },
      { kind: 'integer', key: 'weeklyMinutes', label: $localize`:@@organization-weekly-minutes:Weekly minutes`, required: true, max: 10080 },
      department, establishment, legalVersion,
    ],
  },
};

export const WEEKDAYS = [$localize`:@@organization-sunday:Sunday`, $localize`:@@organization-monday:Monday`, $localize`:@@organization-tuesday:Tuesday`, $localize`:@@organization-wednesday:Wednesday`, $localize`:@@organization-thursday:Thursday`, $localize`:@@organization-friday:Friday`, $localize`:@@organization-saturday:Saturday`];
export const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];

export function resourceGrant(resource: Resource, action: 'create' | 'update' | 'deactivate') {
  if (resource === 'departments') return 'organization:departments:' + action;
  return 'organization:' + ORGANIZATION_RESOURCES[resource].grant;
}
