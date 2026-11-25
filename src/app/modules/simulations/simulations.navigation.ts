export const permissions = {
  read: 'read', create: 'scenarios:create', update: 'scenarios:update', duplicate: 'scenarios:duplicate',
  archive: 'scenarios:archive', execute: 'runs:execute', runs: 'runs:read', retry: 'runs:retry',
  cancel: 'runs:cancel', individual: 'individual:execute', bulk: 'bulk:execute', sensitive: 'salary:read-sensitive',
  compare: 'comparisons:create', projections: 'projections:read', history: 'history:read',
  propose: 'proposals:create', proposals: 'proposals:read', approve: 'proposals:approve', reject: 'proposals:reject',
  export: 'exports:create', download: 'exports:download',
} as const;

export const scenarioTypes = {
  INDIVIDUAL_PAYROLL: 'Individual payroll', BULK_PAYROLL: 'Collective payroll',
  SALARY_INCREASE: 'Salary changes', CONTRACT_CHANGE: 'Contract adjustments',
  NEW_HIRE: 'New hire', PROMOTION: 'Promotion', ALLOWANCES: 'Allowances and benefits',
  OVERTIME: 'Overtime', ABSENCE: 'Absence', LOAN_DEDUCTIONS: 'Loans and deductions',
  EMPLOYER_COST: 'Personnel costs', BUDGET_FORECAST: 'Payroll budget',
  LEGAL_RULE_CHANGE: 'Legal rule changes', RETROACTIVE_IMPACT: 'Retroactive impact', CUSTOM: 'Custom',
} as const;

export type ScenarioType = keyof typeof scenarioTypes;
export const creatableTypes = (Object.keys(scenarioTypes) as ScenarioType[])
  .filter(type => type !== 'NEW_HIRE' && type !== 'LEGAL_RULE_CHANGE');

export interface SimulationSection {
  path: string;
  title: string;
  group: string;
  view: 'scenarios' | 'runs' | 'projections' | 'compare' | 'proposals' | 'exports';
  grants: string[];
  type?: ScenarioType;
}

export function canSimulate(grants: readonly string[], ...required: string[]) {
  return required.every(permission => grants.includes('simulations:' + permission));
}

const p = permissions;
const sensitive = (grant: string) => [grant, p.sensitive];
const scenario = (path: string, title: string, group: string, type?: ScenarioType): SimulationSection =>
  ({ path, title, group, type, view: 'scenarios', grants: sensitive(p.read) });

export const simulationSections: SimulationSection[] = [
  { path: 'overview', title: 'Overview and runs', group: 'Monitoring', view: 'runs', grants: sensitive(p.runs) },
  scenario('individual', scenarioTypes.INDIVIDUAL_PAYROLL, 'Scenarios', 'INDIVIDUAL_PAYROLL'),
  scenario('collective', scenarioTypes.BULK_PAYROLL, 'Scenarios', 'BULK_PAYROLL'),
  scenario('salary', scenarioTypes.SALARY_INCREASE, 'Scenarios', 'SALARY_INCREASE'),
  scenario('contracts', scenarioTypes.CONTRACT_CHANGE, 'Scenarios', 'CONTRACT_CHANGE'),
  scenario('promotions', scenarioTypes.PROMOTION, 'Scenarios', 'PROMOTION'),
  scenario('benefits', scenarioTypes.ALLOWANCES, 'Scenarios', 'ALLOWANCES'),
  scenario('overtime', scenarioTypes.OVERTIME, 'Scenarios', 'OVERTIME'),
  scenario('absences', scenarioTypes.ABSENCE, 'Scenarios', 'ABSENCE'),
  scenario('deductions', scenarioTypes.LOAN_DEDUCTIONS, 'Scenarios', 'LOAN_DEDUCTIONS'),
  scenario('personnel-cost', scenarioTypes.EMPLOYER_COST, 'Planning', 'EMPLOYER_COST'),
  scenario('payroll-budget', scenarioTypes.BUDGET_FORECAST, 'Planning', 'BUDGET_FORECAST'),
  { path: 'projections', title: 'Cost projections', group: 'Planning', view: 'projections', grants: [...sensitive(p.projections), p.runs] },
  { path: 'comparisons', title: 'Comparisons', group: 'Analysis', view: 'compare', grants: [...sensitive(p.compare), p.runs] },
  scenario('saved', 'Saved scenarios and versions', 'History'),
  { path: 'approvals', title: 'Proposals and approvals', group: 'Review', view: 'proposals', grants: sensitive(p.proposals) },
  { path: 'exports', title: 'Export history', group: 'Reports', view: 'exports', grants: sensitive(p.download) },
];
