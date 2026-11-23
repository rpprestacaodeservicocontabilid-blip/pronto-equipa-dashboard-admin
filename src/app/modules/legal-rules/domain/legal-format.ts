import { LegalCategory } from './legal-navigation';
import { LegalVersion } from './legal.models';

export function legalLabel(value: string) {
  return value.toLowerCase().replaceAll('_', ' ').replace(/^./, initial => initial.toUpperCase());
}

export function legalScope(record: LegalVersion) {
  return record.companyId === null ? 'Global' : 'Company #' + record.companyId;
}

export function todayInAngola() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Luanda', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts();
  return ['year', 'month', 'day'].map(part => parts.find(value => value.type === part)?.value).join('-');
}

export function effectiveState(record: LegalVersion, today: string) {
  if (record.status !== 'PUBLISHED') return legalLabel(record.status);
  if (record.effectiveFrom > today) return 'Scheduled';
  return record.effectiveTo && record.effectiveTo < today ? 'Expired' : 'In force';
}

export function safeLegalLink(input: string | undefined | null) {
  if (!input) return null;
  try {
    const url = new URL(input);
    return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function categorySummary(record: LegalVersion, category: LegalCategory): string {
  const rules = record.rules;
  const policy = record.governance;
  switch (category) {
    case 'income-tax': return rules.incomeTaxRules.brackets.length + ' brackets · ' + legalLabel(rules.incomeTaxRules.calculation);
    case 'social-security': return 'Worker ' + rules.socialSecurityRules.employeeRate + ' · Employer ' + rules.socialSecurityRules.employerRate;
    case 'working-time': return legalLabel(rules.laborRules.prorationBasis) +
      (rules.laborRules.maximumDailyOvertimeHours ? ' · Max ' + rules.laborRules.maximumDailyOvertimeHours + ' h/day' : '');
    case 'night-holidays': return (Object.keys(rules.laborRules.nightWorkMultipliers ?? {}).length + ' night work factors') +
      (policy?.holidays ? ' · Holiday policy recorded' : '');
    case 'deductions': return rules.deductionRules.maxPercentageOfGross
      ? 'Gross limit factor ' + rules.deductionRules.maxPercentageOfGross : 'General deduction policy';
    case 'minimum-wage': return policy?.minimumWage ? policy.minimumWage.amount + ' Kz · ' + policy.minimumWage.sector : 'Awaiting policy details';
    case 'leave-allowances': return policy?.leave ? policy.leave.annualDays + ' days · ' + policy.leave.allowanceBasis : 'Awaiting policy details';
    case 'absences': return policy?.absences?.classification ?? 'Awaiting policy details';
    case 'termination': return policy?.termination?.conditions ?? 'Awaiting policy details';
  }
}
