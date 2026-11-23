import { EmployeeSummary } from '../domain/contracts.models';

export function employeeName(employee: EmployeeSummary | undefined | null) {
  return employee ? [employee.firstName, employee.lastName].join(' ') : '—';
}

export function formatContractDate(value: string | null) {
  return value ? new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC' }).format(new Date(value)) : '—';
}

export function contractAmount(value: string | null, currency: string) {
  return value === null ? '—' : new Intl.NumberFormat('en-GB', {
    style: 'currency', currency, currencyDisplay: 'code',
  }).format(Number(value));
}
