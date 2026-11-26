import type { EmployeeSummary } from '../domain/contracts.models';
import { activeLocale } from '../../../core/i18n/locale';

function contractLocale() {
  const locale = activeLocale();
  return locale === 'en' ? 'en-GB' : locale;
}

export function employeeName(employee: EmployeeSummary | undefined | null) {
  return employee ? [employee.firstName, employee.lastName].join(' ') : '—';
}

export function formatContractDate(value: string | null) {
  return value ? new Intl.DateTimeFormat(contractLocale(), { timeZone: 'UTC' }).format(new Date(value)) : '—';
}

export function contractAmount(value: string | null, currency: string) {
  return value === null ? '—' : new Intl.NumberFormat(contractLocale(), {
    style: 'currency', currency, currencyDisplay: 'code',
  }).format(Number(normalizeContractSalary(value)));
}

export const contractSalaryPattern = /^\d+([.,]\d{1,2})?$/;

export function normalizeContractSalary(value: string): string {
  return value.replace(',', '.');
}

export function departmentNumber(id: string | number) {
  return $localize`:@@contracts-department-number:Department #${id}:NUMBER:`;
}
