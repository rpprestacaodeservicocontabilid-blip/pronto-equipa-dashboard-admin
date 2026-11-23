import { Observable } from 'rxjs';
import { TODAY, UUID, human, validDate } from '../domain/salary-format';

export type Values = Record<string, string | boolean>;
export interface Choice { value: string; label: string }
export interface Field {
  key: string;
  label: string;
  kind?: 'date' | 'textarea' | 'select' | 'check' | 'amount' | 'id';
  required?: boolean;
  max?: number;
  initial?: string | boolean;
  choices?: Choice[];
  when?: (values: Values) => boolean;
  reference?: 'employee' | 'contract' | 'component' | 'structure';
}
export interface SalaryForm {
  title: string;
  description?: string;
  confirm?: string;
  submitLabel?: string;
  fields: Field[];
  group?: { title: string; fields: Field[]; rows?: Values[]; min?: number; max?: number };
  send: (fields: Values, rows: Values[]) => Observable<unknown>;
}
export const string = (values: Values, key: string) => String(values[key] ?? '').trim();
export const flag = (values: Values, key: string) => values[key] === true;
export const effectiveFrom = (value = TODAY()): Field => ({ key: 'effectiveFrom', label: 'Effective from', kind: 'date', required: true, initial: value });
export const identity = (key: string, label: string, reference?: Field['reference'], initial = ''): Field =>
  ({ key, label, kind: 'id', required: true, max: 36, reference, initial });
export const choose = (key: string, label: string, choices: string[], value = choices[0]): Field =>
  ({ key, label, kind: 'select', required: true, choices: choices.map(value => ({ value, label: human(value) })), initial: value });
export const currency = (value = 'AOA'): Field => ({ key: 'currency', label: 'Currency (ISO code)', required: true, max: 3, initial: value });
export function currencyValue(values: Values) {
  const value = string(values, 'currency').toUpperCase();
  if (!/^[A-Z]{3}$/.test(value)) throw new Error('Enter a three-letter currency code.');
  return value;
}
export function initialValues(fields: Field[]): Values {
  return Object.fromEntries(fields.map(field => [field.key, field.initial ?? (field.kind === 'check' ? false : '')]));
}
export function validate(fields: Field[], values: Values) {
  for (const field of fields) {
    if (field.when && !field.when(values)) continue;
    const value = string(values, field.key);
    if (field.required && !value) throw new Error(field.label + ' is required.');
    if (!value) continue;
    if ((field.max && value.length > field.max) ||
      (field.kind === 'id' && !UUID.test(value)) || (field.kind === 'date' && !validDate(value)) ||
      (field.kind === 'select' && !field.choices?.some(choice => choice.value === value))) throw new Error('Check ' + field.label + '.');
  }
}
