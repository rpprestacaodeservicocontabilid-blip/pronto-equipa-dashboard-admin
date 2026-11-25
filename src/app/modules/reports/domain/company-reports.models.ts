export type Domain = 'hr' | 'contracts' | 'attendance' | 'leave' | 'payroll' | 'tax' | 'payments' | 'loans' | 'payslips';
export interface ReportFilters {
  from?: string; to?: string; employeeId?: string; departmentId?: number; status?: string; limit?: number;
}
export type FilterKey = Exclude<keyof ReportFilters, 'limit'>;
export interface CompanyReport {
  code: string; name: string; source: string; description: string; domain: Domain;
  workspaceFilters?: FilterKey[];
}
export interface ReportConfiguration extends CompanyReport { fields: string[] }
export type DataRow = Record<string, unknown>;
export interface RunSummary { id: string; code: string; status: string; rowCount: number; generatedAt: string }
export interface CompanyReportResult extends RunSummary { data: DataRow[]; definitionVersion?: number; filters?: ReportFilters }
export interface ReportFile { id: string; code?: string; filename: string; rowCount: number; status: string; expiresAt: string }
export interface CustomReport { id: string; code: string; name: string; status: string; fields: string[]; version: number; filters: ReportFilters }
export interface CustomPreview { code: string; version: number; rowCount: number; data: DataRow[] }
export interface ReportTotals {
  grossAmount: string; netAmount: string; employerCostsAmount: string; personnelCost: string;
  currency: string; closedResults: number;
}
export interface CompanyIndicators {
  asOf: string; workforce: { active: number; total: number }; payrollByCurrency: ReportTotals[];
}
export const domainLabels: Record<Domain, string> = {
  hr: 'Human resources', contracts: 'Contracts', attendance: 'Attendance', leave: 'Leave and absences',
  payroll: 'Payroll', tax: 'IRT and INSS', payments: 'Payments', loans: 'Loans', payslips: 'Payslips',
};

export function fieldLabel(key: string) {
  const labels: Record<string, string> = { id: 'ID', employeeId: 'Worker ID', runId: 'Payroll run ID', irt: 'IRT',
    employeeInss: 'Worker INSS', employerInss: 'Employer INSS', legalRuleSetVersion: 'Legal rule version' };
  return labels[key] ?? key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
}
