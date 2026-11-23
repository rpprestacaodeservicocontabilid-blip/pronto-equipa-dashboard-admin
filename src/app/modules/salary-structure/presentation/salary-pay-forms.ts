import { amount, jsonConfig, percent } from '../domain/salary-format';
import { Override, PayInput } from '../domain/salary.models';
import { Field, Values, choose, currency, currencyValue, effectiveFrom, identity, string } from './salary-form';

export const employeeField = identity('employeeId', 'Employee ID', 'employee');
export const reasonField: Field = { key: 'reason', label: 'Reason', kind: 'textarea', required: true, max: 2000 };
export const overrideFields: Field[] = [
  identity('componentVersionId', 'Component version ID', 'component'),
  { key: 'amount', label: 'Amount override', kind: 'amount', max: 19 },
  { key: 'sourceReference', label: 'Authorized source reference', max: 200 },
  { key: 'percentage', label: 'Percentage override', kind: 'amount', max: 8 },
  choose('condition', 'Conditional component', ['DEFAULT', 'ENABLED', 'DISABLED']),
];
export const payFields = (initial?: Partial<PayInput>, structureRequired = true): Field[] => [
  { ...identity('structureVersionId', 'Structure version ID', 'structure', initial?.structureVersionId), required: structureRequired },
  { key: 'baseSalary', label: 'Base salary', kind: 'amount', max: 19, required: true, initial: String(initial?.baseSalary ?? '') },
  currency(initial?.currency),
];
export const payDate = () => effectiveFrom();

export function payInput(values: Values, rows: Values[]): PayInput {
  const ids = new Set<string>();
  const components: Override[] = rows.map(row => {
    const componentVersionId = string(row, 'componentVersionId').toLowerCase();
    if (ids.has(componentVersionId)) throw new Error('Each component version can be selected once.');
    ids.add(componentVersionId);
    const value = string(row, 'amount');
    const percentage = string(row, 'percentage');
    const condition = string(row, 'condition');
    const config = jsonConfig(string(row, 'originalConfig'));
    delete config['percentage'];
    delete config['enabled'];
    return { componentVersionId, amount: value ? amount(value) : undefined, sourceReference: string(row, 'sourceReference') || undefined,
      calculationConfig: { ...config, ...(percentage ? { percentage: percent(percentage) } : {}),
        ...(condition === 'ENABLED' || condition === 'DISABLED' ? { enabled: condition === 'ENABLED' } : {}) } };
  });
  return { structureVersionId: string(values, 'structureVersionId'), baseSalary: amount(string(values, 'baseSalary'), true),
    currency: currencyValue(values), components };
}
