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

const establishment: Field = { kind: 'reference', key: 'establishmentId', label: 'Establishment', source: 'establishments' };
const department: Field = { kind: 'reference', key: 'departmentId', label: 'Department', source: 'departments' };
const legalVersion: Field = { kind: 'text', key: 'legalRuleVersionId', label: 'Legal rule version ID', max: 120 };
const description = (max = 1000): Field => ({ kind: 'textarea', key: 'description', label: 'Description', max });
const level: Field = { kind: 'integer', key: 'hierarchicalLevel', label: 'Hierarchy level', max: 100 };

export const ORGANIZATION_RESOURCES: Record<Resource, ResourceConfig> = {
  departments: {
    label: 'Departments', grant: 'departments:update', fields: [
      description(), establishment, { kind: 'reference', key: 'managerEmployeeId', label: 'Manager', source: 'employees' },
    ],
  },
  'job-functions': {
    label: 'Job functions', grant: 'functions:manage', fields: [
      { kind: 'reference', key: 'relatedId', label: 'Professional category', source: 'professional-categories', topLevel: true },
      description(2000), { kind: 'textarea', key: 'responsibilities', label: 'Responsibilities', max: 2000 },
      { kind: 'lines', key: 'requirements', label: 'Qualifications and requirements (one per line)', max: 250 }, level,
    ],
  },
  'job-positions': {
    label: 'Job positions', grant: 'positions:manage', fields: [
      { kind: 'reference', key: 'relatedId', label: 'Job function', source: 'job-functions', topLevel: true, required: true },
      department, level, description(),
    ],
  },
  'professional-categories': {
    label: 'Professional categories', grant: 'categories:manage', fields: [
      { kind: 'text', key: 'classification', label: 'Classification', max: 100 }, description(),
    ],
  },
  'cost-centers': {
    label: 'Cost centers', grant: 'cost-centers:manage', fields: [
      { kind: 'reference', key: 'parentId', label: 'Parent cost center', source: 'cost-centers', topLevel: true },
      establishment, description(),
    ],
  },
  'cost-allocations': { label: 'Cost allocations', grant: 'cost-allocations:manage', fields: [] },
  establishments: {
    label: 'Establishments', grant: 'establishments:manage', fields: [
      { kind: 'select', key: 'establishmentType', label: 'Establishment type', required: true, choices: [
        { value: 'HEADQUARTERS', label: 'Headquarters' }, { value: 'BRANCH', label: 'Branch' },
        { value: 'DELEGATION', label: 'Delegation' }, { value: 'OPERATIONAL_SITE', label: 'Operational site' },
      ] },
      { kind: 'text', key: 'province', label: 'Province', required: true, max: 100 },
      { kind: 'text', key: 'municipality', label: 'Municipality', required: true, max: 100 },
      { kind: 'text', key: 'address', label: 'Address', max: 500 },
      { kind: 'email', key: 'email', label: 'Email', max: 255 },
      { kind: 'text', key: 'phone', label: 'Phone', max: 40 },
      { kind: 'reference', key: 'responsibleEmployeeId', label: 'Responsible employee', source: 'employees' },
      { kind: 'date', key: 'openedAt', label: 'Opening date' },
      { kind: 'date', key: 'closedAt', label: 'Closing date' },
    ],
  },
  calendars: {
    label: 'Work calendars', grant: 'calendars:manage', dated: true, fields: [
      establishment, { kind: 'weekdays', key: 'workingWeekdays', label: 'Working days', required: true },
      legalVersion, description(),
    ],
  },
  schedules: {
    label: 'Work schedules', grant: 'schedules:manage', dated: true, fields: [
      { kind: 'select', key: 'scheduleType', label: 'Schedule type', required: true, choices: [
        { value: 'FIXED', label: 'Fixed' }, { value: 'VARIABLE', label: 'Variable' }, { value: 'SHIFT', label: 'Shift-based' },
      ] },
      { kind: 'integer', key: 'weeklyMinutes', label: 'Weekly minutes', required: true, max: 10080 },
      department, establishment, legalVersion,
    ],
  },
};

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];

export function resourceGrant(resource: Resource, action: 'create' | 'update' | 'deactivate') {
  if (resource === 'departments') return 'organization:departments:' + action;
  return 'organization:' + ORGANIZATION_RESOURCES[resource].grant;
}
