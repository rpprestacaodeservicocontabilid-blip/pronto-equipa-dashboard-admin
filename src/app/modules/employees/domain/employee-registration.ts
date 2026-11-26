import { ImportSheet, readCsv } from '../../../shared/utils/read-csv';
import { EmployeeRegistration } from './employee.models';

export const registrationFields = [
  { key: 'employeeNumber', label: $localize`:@@employees-employee-number:Employee number`, max: 50, required: true, type: 'text' },
  { key: 'firstName', label: $localize`:@@employees-first-name:First name`, max: 100, required: true, type: 'text' },
  { key: 'lastName', label: $localize`:@@employees-last-name:Last name`, max: 100, required: true, type: 'text' },
  { key: 'admissionDate', label: $localize`:@@employees-admission-date:Admission date`, max: 10, required: true, type: 'date' },
  { key: 'jobTitle', label: $localize`:@@employees-job-title:Job title`, max: 150, required: false, type: 'text' },
  { key: 'jobCategory', label: $localize`:@@employees-job-category:Job category`, max: 100, required: false, type: 'text' },
  { key: 'dateOfBirth', label: $localize`:@@employees-date-of-birth:Date of birth`, max: 10, required: false, type: 'date' },
  { key: 'nationality', label: $localize`:@@employees-nationality:Nationality`, max: 80, required: false, type: 'text' },
  { key: 'email', label: $localize`:@@employees-email:Email`, max: 255, required: false, type: 'email' },
  { key: 'phone', label: $localize`:@@employees-telephone:Telephone`, max: 40, required: false, type: 'tel' },
] as const;

export const csvColumns = [...registrationFields.map(field => field.key), 'departmentId'];

export function emptyEmployee(): EmployeeRegistration {
  return {
    employeeNumber: '', firstName: '', lastName: '', admissionDate: '',
    jobTitle: null, jobCategory: null, dateOfBirth: null, nationality: null,
    email: null, phone: null, departmentId: null,
  };
}

export function normalizeEmployee(input: EmployeeRegistration): EmployeeRegistration {
  const row = { ...input };
  for (const { key, label, max, required, type } of registrationFields) {
    const value = row[key]?.trim() ?? '';
    if ((required && !value) || value.length > max) {
      throw new Error($localize`:@@employees-check-field:Check the “${label}:FIELD:” field.`);
    }
    if (value && type === 'date' && !isDate(value)) {
      throw new Error($localize`:@@employees-field-date-invalid:The “${label}:FIELD:” field requires a valid YYYY-MM-DD date.`);
    }
    if (value && type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error($localize`:@@employees-enter-a-valid-email-address:Enter a valid email address.`);
    if (key === 'employeeNumber' || key === 'firstName' || key === 'lastName' || key === 'admissionDate') row[key] = value;
    else row[key] = value || null;
  }
  if (row.departmentId !== null && (!Number.isSafeInteger(row.departmentId) || row.departmentId < 1)) {
    throw new Error($localize`:@@employees-department-id-must-be-a-positive-integer:Department ID must be a positive integer.`);
  }
  return row;
}

function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function previewEmployees(source: string) {
  let sheet: ImportSheet;
  try {
    sheet = readCsv(source, 500);
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    switch (error.message) {
      case 'Invalid quotation in the CSV file.':
        throw new Error($localize`:@@employees-invalid-quotation-in-the-csv-file:Invalid quotation in the CSV file.`);
      case 'The CSV contains an unclosed quoted field.':
        throw new Error($localize`:@@employees-the-csv-contains-an-unclosed-quoted-field:The CSV contains an unclosed quoted field.`);
      case 'Use a CSV with a header and at least one row.':
        throw new Error($localize`:@@employees-use-a-csv-with-a-header-and-at-least-one-row:Use a CSV with a header and at least one row.`);
      case 'Import up to 500 rows per file.':
        throw new Error($localize`:@@employees-import-up-to-500-rows-per-file:Import up to 500 rows per file.`);
      default: throw error;
    }
  }
  return previewEmployeeRows(sheet);
}

export function previewEmployeeRows({ columns, rows }: ImportSheet) {
  if (new Set(columns).size !== columns.length ||
    registrationFields.some(field => field.required && !columns.includes(field.key))) {
    throw new Error($localize`:@@employees-use-the-template-headers-and-include-each-required-column-once:Use the template headers and include each required column once.`);
  }
  const numbers = new Set<string>();
  const errors: { record: number; message: string }[] = [];
  const employees: EmployeeRegistration[] = [];
  rows.forEach((values, index) => {
    try {
      if (values.length !== columns.length) throw new Error($localize`:@@employees-column-count-does-not-match-the-header:Column count does not match the header.`);
      const cells = Object.fromEntries(columns.map((column, i) => [column, values[i]]));
      const data = emptyEmployee();
      for (const { key } of registrationFields) data[key] = cells[key] ?? '';
      data.departmentId = cells['departmentId'] ? Number(cells['departmentId']) : null;
      const employee = normalizeEmployee(data);
      if (numbers.has(employee.employeeNumber.toLowerCase())) throw new Error($localize`:@@employees-duplicate-employee-number-in-this-file:Duplicate employee number in this file.`);
      numbers.add(employee.employeeNumber.toLowerCase());
      employees.push(employee);
    } catch (error) {
      errors.push({ record: index + 1, message: error instanceof Error ? error.message : $localize`:@@employees-invalid-employee-record:Invalid employee record.` });
    }
  });
  return { employees, errors };
}
