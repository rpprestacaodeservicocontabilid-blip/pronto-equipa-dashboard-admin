import { Bracket, Governance, LegalInput, LegalVersion } from './legal.models';

const decimal = /^(0|[1-9]\d{0,15})(\.\d{1,6})?$/;
const rate = /^(0(\.\d{1,6})?|1(\.0{1,6})?)$/;
const normalize = (value: string | null | undefined) => value?.trim().replace(',', '.') ?? '';
const optional = (value: string | null | undefined) => normalize(value) || undefined;
const words = (text: string) => [...new Set(text.split(/[,\n]+/).map(item => item.trim()).filter(Boolean))];
const micros = (value: string) => BigInt(value.split('.')[0]) * 1_000_000n + BigInt((value.split('.')[1] ?? '').padEnd(6, '0'));

export interface NamedFactor { code: string; value: string }

export class LegalDraft {
  readonly input: LegalInput;
  readonly policy: Required<Omit<Governance, 'sourceIds' | 'leave'>> & {
    leave: { annualDays: number | null; acquisition: string; allowanceBasis: string };
  };
  readonly sourceIds: string[];
  readonly overtime: NamedFactor[];
  readonly nightWork: NamedFactor[];
  taxIncluded: string;
  taxExcluded: string;
  contributionIncluded: string;
  contributionExcluded: string;
  categories: string;
  engineVersions: string;

  constructor(record?: LegalVersion, newVersion = false) {
    this.input = record ? {
      companyId: record.companyId, ruleSetId: record.ruleSetId, version: newVersion ? '' : record.version,
      jurisdiction: 'AO', effectiveFrom: newVersion ? '' : record.effectiveFrom, effectiveTo: newVersion ? null : record.effectiveTo,
      sourceReference: record.sourceReference, evidenceReference: record.evidenceReference, rules: structuredClone(record.rules),
    } : {
      companyId: null, ruleSetId: '', version: '', jurisdiction: 'AO', effectiveFrom: '', effectiveTo: null,
      sourceReference: '', evidenceReference: '', rules: {
        roundingPolicy: { mode: 'HALF_EVEN', scale: 2 }, laborRules: { prorationBasis: 'CALENDAR_DAYS' },
        incomeTaxRules: { calculation: 'PROGRESSIVE', brackets: [{ from: '0', to: null, rate: '' }] },
        socialSecurityRules: { employeeRate: '', employerRate: '' }, deductionRules: {},
      },
    };
    const rules = this.input.rules;
    const detail = record?.governance;
    this.sourceIds = [...(detail?.sourceIds ?? [])];
    this.policy = {
      minimumWage: { amount: '', sector: '', regime: '', ...detail?.minimumWage },
      holidays: { conditions: '', ...detail?.holidays },
      leave: { annualDays: null, acquisition: '', allowanceBasis: '', ...detail?.leave },
      absences: { classification: '', payTreatment: '', ...detail?.absences },
      termination: { conditions: '', compensationBasis: '', ...detail?.termination },
    };
    const named = (entries: Record<string, string> | undefined) =>
      Object.entries(entries ?? {}).map(([code, value]) => ({ code, value }));
    this.overtime = named(rules.laborRules.overtimeMultipliers);
    this.nightWork = named(rules.laborRules.nightWorkMultipliers);
    this.taxIncluded = rules.incomeTaxRules.includedComponentCodes?.join(', ') ?? '';
    this.taxExcluded = rules.incomeTaxRules.excludedComponentCodes?.join(', ') ?? '';
    this.contributionIncluded = rules.socialSecurityRules.includedComponentCodes?.join(', ') ?? '';
    this.contributionExcluded = rules.socialSecurityRules.excludedComponentCodes?.join(', ') ?? '';
    this.categories = rules.deductionRules.allowedCategories?.join(', ') ?? '';
    this.engineVersions = rules.compatibility?.engineVersions.join(', ') ?? '';
  }

  static checkBrackets(brackets: Bracket[]) {
    if (!brackets.length) return 'Add at least one tax bracket.';
    const normalized = brackets.map(row => ({
      from: normalize(row.from), to: optional(row.to), rate: normalize(row.rate), deduction: optional(row.deduction),
    }));
    if (normalized.some(row => !decimal.test(row.from) || !rate.test(row.rate) ||
      (row.to && !decimal.test(row.to)) || (row.deduction && !decimal.test(row.deduction)))) {
      return 'Enter valid decimal bounds and a rate between 0 and 1 for every bracket.';
    }
    if (micros(normalized[0].from) !== 0n) return 'The first bracket must start at zero.';
    for (let index = 0; index < normalized.length; index++) {
      const row = normalized[index];
      if (row.to && micros(row.to) <= micros(row.from)) return 'A bracket must end above its lower bound.';
      if (index < normalized.length - 1 && (!row.to || micros(row.to) !== micros(normalized[index + 1].from))) {
        return 'Each bracket must meet the next bracket without gaps or overlaps.';
      }
    }
    return normalized.at(-1)?.to ? 'Leave the upper bound of the last bracket empty.' : '';
  }

  toInput(): LegalInput {
    const required = (value: string, message: string) => {
      if (!value?.trim()) throw new Error(message);
      return value.trim();
    };
    const amount = (value: string | null | undefined, message: string) => {
      const parsed = optional(value);
      if (parsed && !decimal.test(parsed)) throw new Error(message);
      return parsed;
    };
    const factor = (value: string | null | undefined, message: string) => {
      const parsed = normalize(value);
      if (!rate.test(parsed)) throw new Error(message);
      return parsed;
    };
    const list = (value: string) => {
      const parsed = words(value);
      return parsed.length ? parsed : undefined;
    };
    const factors = (rows: NamedFactor[]) => {
      const entries = rows.map(row => [row.code.trim(), normalize(row.value)] as const);
      if (entries.some(([key, value]) => !/^[a-z0-9][a-z0-9_:-]{0,63}$/i.test(key) || !decimal.test(value) || micros(value) > 1_000_000_000n) ||
        new Set(entries.map(([key]) => key)).size !== entries.length) {
        throw new Error('Overtime and night work factors require unique codes and valid decimal values.');
      }
      return entries.length ? Object.fromEntries(entries) : undefined;
    };
    const { companyId, effectiveFrom, rules } = this.input;
    const effectiveTo = this.input.effectiveTo || null;
    if (!effectiveFrom || effectiveTo && effectiveTo < effectiveFrom) throw new Error('Enter a valid effective date interval.');
    if (companyId !== null && (!Number.isSafeInteger(companyId) || companyId < 1)) throw new Error('Enter a positive company identifier or leave it blank for global scope.');
    const social = rules.socialSecurityRules;
    const tax = rules.incomeTaxRules;
    const deductions = rules.deductionRules;
    const labour = rules.laborRules;
    const bracketError = LegalDraft.checkBrackets(tax.brackets);
    if (bracketError) throw new Error(bracketError);
    const min = amount(social.minimumBase, 'Enter a valid minimum contribution base.');
    const max = amount(social.maximumBase, 'Enter a valid maximum contribution base.');
    if (min && max && micros(min) > micros(max)) throw new Error('The minimum contribution base cannot exceed the maximum.');
    const fixed = labour.prorationBasis === 'FIXED_PERIOD_DAYS';
    const days = labour.fixedPeriodDays;
    if (fixed && (!Number.isSafeInteger(days) || !days || days < 1)) throw new Error('Fixed-day proration requires a positive number of days.');
    const engineVersions = list(this.engineVersions);
    const governance: Governance = this.sourceIds.length ? { sourceIds: [...this.sourceIds] } : {};
    const { minimumWage, holidays, leave, absences, termination } = this.policy;
    if (minimumWage.amount.trim() || minimumWage.sector.trim() || minimumWage.regime.trim()) {
      const value = amount(minimumWage.amount, 'Enter a valid minimum wage.');
      if (!value || !minimumWage.sector.trim() || !minimumWage.regime.trim()) throw new Error('Minimum wage requires an amount, sector and regime.');
      governance.minimumWage = { amount: value, sector: minimumWage.sector.trim(), regime: minimumWage.regime.trim() };
    }
    if (holidays.conditions.trim() || holidays.multiplier?.trim()) {
      governance.holidays = { conditions: required(holidays.conditions, 'Describe the conditions for holiday work.'),
        multiplier: amount(holidays.multiplier, 'Enter a valid holiday multiplier.') };
    }
    if (leave.annualDays != null || leave.acquisition.trim() || leave.allowanceBasis.trim()) {
      if (leave.annualDays == null || !Number.isInteger(leave.annualDays) || leave.annualDays < 0 || leave.annualDays > 366)
        throw new Error('Leave requires an annual entitlement between 0 and 366 days.');
      governance.leave = { annualDays: leave.annualDays,
        acquisition: required(leave.acquisition, 'Describe leave acquisition.'),
        allowanceBasis: required(leave.allowanceBasis, 'Describe the allowance calculation basis.') };
    }
    if (absences.classification.trim() || absences.payTreatment.trim()) {
      governance.absences = { classification: required(absences.classification, 'Enter the absence classification.'),
        payTreatment: required(absences.payTreatment, 'Enter the pay treatment for absences.') };
    }
    if (termination.conditions.trim() || termination.compensationBasis.trim()) {
      governance.termination = { conditions: required(termination.conditions, 'Enter the termination conditions.'),
        compensationBasis: required(termination.compensationBasis, 'Enter the compensation basis.') };
    }
    return {
      companyId, effectiveFrom, effectiveTo, jurisdiction: 'AO',
      ruleSetId: required(this.input.ruleSetId, 'Enter a rule set identifier.'),
      version: required(this.input.version, 'Enter a version.'),
      sourceReference: required(this.input.sourceReference, 'Enter the official source reference.'),
      evidenceReference: required(this.input.evidenceReference, 'Enter the legal review evidence reference.'),
      governance: Object.keys(governance).length ? governance : null,
      rules: {
        roundingPolicy: { ...rules.roundingPolicy },
        laborRules: { prorationBasis: labour.prorationBasis, fixedPeriodDays: fixed ? days : undefined,
          maximumDailyOvertimeHours: amount(labour.maximumDailyOvertimeHours, 'Enter a valid daily overtime limit.'),
          overtimeMultipliers: factors(this.overtime), nightWorkMultipliers: factors(this.nightWork) },
        socialSecurityRules: {
          employeeRate: factor(social.employeeRate, 'Enter a worker INSS rate between 0 and 1.'),
          employerRate: factor(social.employerRate, 'Enter an employer INSS rate between 0 and 1.'),
          minimumBase: min, maximumBase: max, includedComponentCodes: list(this.contributionIncluded), excludedComponentCodes: list(this.contributionExcluded),
        },
        incomeTaxRules: {
          calculation: tax.calculation, exemptionAmount: amount(tax.exemptionAmount, 'Enter a valid tax exemption amount.'),
          socialSecurityDeductible: tax.socialSecurityDeductible, includedComponentCodes: list(this.taxIncluded), excludedComponentCodes: list(this.taxExcluded),
          brackets: tax.brackets.map(row => ({ from: normalize(row.from), to: optional(row.to) ?? null, rate: normalize(row.rate), deduction: optional(row.deduction) })),
        },
        deductionRules: {
          maxPercentageOfGross: normalize(deductions.maxPercentageOfGross)
            ? factor(deductions.maxPercentageOfGross, 'Enter a deduction limit between 0 and 1.') : undefined,
          protectedNetAmount: amount(deductions.protectedNetAmount, 'Enter a valid protected net amount.'),
          allowPartial: deductions.allowPartial, allowedCategories: list(this.categories),
        },
        ...(engineVersions ? { compatibility: { engineVersions } } : {}),
      },
    };
  }
}
