import { amount, cents, jsonConfig, percent } from '../domain/salary-format';
import { CALCULATION_METHODS, COMPONENT_TYPES, ComponentVersion, FREQUENCIES, StructureInput } from '../domain/salary.models';
import { Field, Values, choose, currency, currencyValue, effectiveFrom, flag, identity, string } from './salary-form';

export const recordFields: Field[] = [
  { key: 'code', label: 'Code', required: true, max: 50 },
  { key: 'name', label: 'Name', required: true, max: 150 },
];
const description: Field = { key: 'description', label: 'Description', kind: 'textarea', max: 1000 };
export const componentFields = (allowances: boolean, version?: ComponentVersion): Field[] => [
  choose('componentType', 'Component type', allowances ? ['ALLOWANCE', 'BENEFIT'] : COMPONENT_TYPES, version?.componentType),
  choose('calculationMethod', 'Calculation method', CALCULATION_METHODS, version?.calculationMethod),
  choose('frequency', 'Frequency', FREQUENCIES, version?.frequency),
  currency(version?.currency),
  effectiveFrom(),
  { key: 'legalClassificationRef', label: 'Legal classification reference', max: 120, initial: version?.legalClassificationRef ?? '' },
  { key: 'percentage', label: 'Percent of base salary', kind: 'amount', required: true, max: 8,
    initial: typeof version?.calculationConfig['percentage'] === 'string' ? version.calculationConfig['percentage'] : '',
    when: values => values['calculationMethod'] === 'FORMULA' },
  { key: 'enabled', label: 'Enable conditional component by default', kind: 'check',
    initial: version?.calculationConfig['enabled'] === true, when: values => values['calculationMethod'] === 'CONDITIONAL' },
];

export const editComponentFields = (name: string, text: string | null | undefined): Field[] => [
  { ...recordFields[1], initial: name }, { ...description, initial: text ?? '' },
];
export const createComponentFields = (allowances: boolean): Field[] => [...recordFields, description, ...componentFields(allowances)];

export function componentInput(values: Values) {
  const calculationMethod = string(values, 'calculationMethod');
  const calculationConfig = calculationMethod === 'FORMULA' ? { operation: 'PERCENT_OF_BASE', percentage: percent(string(values, 'percentage')) }
    : calculationMethod === 'CONDITIONAL' ? { enabled: flag(values, 'enabled') } : {};
  return {
    componentType: string(values, 'componentType'), calculationMethod, frequency: string(values, 'frequency'),
    effectiveFrom: string(values, 'effectiveFrom'), currency: currencyValue(values), calculationConfig,
    legalClassificationRef: string(values, 'legalClassificationRef') || undefined,
  };
}

export const structureFields: Field[] = [
  identity('componentVersionId', 'Component version ID', 'component'),
  { key: 'amount', label: 'Fixed or one-time amount', kind: 'amount', max: 19 },
  { key: 'percentage', label: 'Percentage of base', kind: 'amount', max: 8 },
  { key: 'required', label: 'Required component', kind: 'check' },
];

export function structureItems(rows: Values[]): StructureInput[] {
  const ids = new Set<string>();
  return rows.map(row => {
    const componentVersionId = string(row, 'componentVersionId').toLowerCase();
    if (ids.has(componentVersionId)) throw new Error('Each component version can be selected once.');
    ids.add(componentVersionId);
    const value = string(row, 'amount');
    const percentage = string(row, 'percentage');
    return { componentVersionId, amount: value ? amount(value) : undefined, percentage: percentage ? percent(percentage) : undefined,
      required: flag(row, 'required'), calculationConfig: jsonConfig(string(row, 'originalConfig')) };
  });
}

export const gradeFields: Field[] = [
  ...recordFields,
  { key: 'minAmount', label: 'Minimum amount', required: true, kind: 'amount', max: 19 },
  { key: 'maxAmount', label: 'Maximum amount', required: true, kind: 'amount', max: 19 },
  currency(),
  { key: 'functionCode', label: 'Job function code', max: 100 },
  { key: 'categoryCode', label: 'Professional category code', max: 100 },
];

export function gradeInput(values: Values) {
  const minAmount = amount(string(values, 'minAmount'));
  const maxAmount = amount(string(values, 'maxAmount'));
  if (cents(minAmount)! > cents(maxAmount)!) throw new Error('Grade minimum cannot exceed the maximum.');
  return { code: string(values, 'code'), name: string(values, 'name'), minAmount, maxAmount, currency: currencyValue(values),
    functionCode: string(values, 'functionCode') || undefined, categoryCode: string(values, 'categoryCode') || undefined };
}
