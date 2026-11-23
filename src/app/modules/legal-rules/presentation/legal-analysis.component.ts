import { Component, computed, DestroyRef, inject, Input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { downloadWorkbook } from '../../../shared/utils/report-documents';
import { payrollMoney } from '../../payroll/domain/payroll-format';
import { payrollQuery } from '../../payroll/presentation/payroll-ui';
import { compareVersions } from '../domain/legal-comparison';
import { legalScope } from '../domain/legal-format';
import { IMPACT_METRICS, ImpactMetric, ImpactResult } from '../domain/legal.models';
import { LegalRulesApi } from '../infrastructure/legal-rules-api.service';

@Component({
  selector: 'app-legal-analysis', standalone: true, imports: [FormsModule, ComponentCardComponent],
  templateUrl: './legal-analysis.component.html',
})
export class LegalAnalysisComponent {
  @Input() impact = false;
  private readonly api = inject(LegalRulesApi);
  private readonly destroy = inject(DestroyRef);
  private readonly refresh = signal(0);
  protected readonly versions = payrollQuery(this.refresh, () => this.api.versions());
  protected readonly left = signal('');
  protected readonly right = signal('');
  protected readonly result = signal<ImpactResult | null>(null);
  protected readonly working = signal(false);
  protected readonly error = signal('');
  protected readonly money = payrollMoney;
  protected readonly scope = legalScope;
  protected readonly metrics = IMPACT_METRICS;
  protected readonly captions: Record<ImpactMetric, string> = {
    incomeTax: 'Income tax (IRT)', employeeSocialSecurity: 'Worker INSS', employerSocialSecurity: 'Employer INSS',
    netAmount: 'Net pay', totalEmployerCost: 'Total employer cost',
  };
  protected baselineMonth = '';
  protected proposalMonth = '';
  protected salaryList = '';
  private readonly selected = computed(() => {
    const result = this.versions();
    const rows = result && 'data' in result ? result.data : [];
    return { baseline: rows.find(row => row.id === this.left()), proposal: rows.find(row => row.id === this.right()) };
  });
  protected readonly difference = computed(() => {
    const {baseline, proposal} = this.selected();
    return baseline && proposal && baseline.id !== proposal.id ? compareVersions(baseline, proposal) : null;
  });
  protected reload() { this.refresh.update(value => value + 1); }
  protected clear() { this.result.set(null); this.error.set(''); }

  protected change(id: string, side: 'left' | 'right') {
    if (side === 'left') this.left.set(id); else this.right.set(id);
    const selected = this.selected();
    if (side === 'left') this.baselineMonth = selected.baseline?.effectiveFrom.slice(0, 7) ?? '';
    else this.proposalMonth = selected.proposal?.effectiveFrom.slice(0, 7) ?? '';
    this.clear();
  }

  protected run() {
    if (this.working()) return;
    const { baseline, proposal } = this.selected();
    const salaries = this.salaryList.split(/[;\n]+/).map(item => item.trim().replace(',', '.')).filter(Boolean);
    this.clear();
    if (!baseline || !proposal || baseline.id === proposal.id || baseline.companyId !== proposal.companyId) {
      this.error.set('Choose two different versions for the same scope.');
      return;
    }
    if (!this.baselineMonth || !this.proposalMonth || !salaries.length || salaries.length > 25 ||
      salaries.some(salary => !/^(0|[1-9]\d{0,11})(\.\d{1,6})?$/.test(salary))) {
      this.error.set('Enter both months and 1 to 25 fictional salaries. Separate the amounts with new lines or semicolons.');
      return;
    }
    this.working.set(true);
    this.api.impact({ baselineId: baseline.id, proposalId: proposal.id, baselineMonth: this.baselineMonth, proposalMonth: this.proposalMonth, salaries }).pipe(
      takeUntilDestroyed(this.destroy), finalize(() => this.working.set(false)),
    ).subscribe({ next: result => this.result.set(result), error: error => this.error.set(apiErrorMessage(error)) });
  }

  protected export() {
    const result = this.result();
    const { baseline, proposal } = this.selected();
    if (!result || !baseline || !proposal) return;
    const description = baseline.ruleSetId + ' ' + baseline.version + ' (' + this.baselineMonth + ') → ' +
      proposal.ruleSetId + ' ' + proposal.version + ' (' + this.proposalMonth + ')';
    downloadWorkbook('legal-impact', {
      title: 'Regulatory impact simulation · ' + description, company: 'PRONTOEQUIPAS · Payroll engine ' + result.engineVersion,
      headings: ['Fictional salary (AOA)', 'Metric', 'Baseline (AOA)', 'Proposal (AOA)', 'Difference (AOA)'],
      rows: result.rows.flatMap(row => IMPACT_METRICS.map(metric => [row.salary, this.captions[metric], row.baseline[metric], row.proposal[metric], row.difference[metric]])),
    });
  }
}
