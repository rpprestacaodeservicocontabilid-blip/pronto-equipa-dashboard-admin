import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { of, map, Observable } from 'rxjs';
import { CompanyWorkspace } from '../../../core/api/company-workspace-api';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { payrollDate, payrollLabel, payrollMoney } from '../domain/payroll-format';
import { PayrollApproval, PayrollClosing, PayrollInstruction, PayrollIssue, PayrollRun, PayrollSummary } from '../domain/payroll.models';
import { HISTORY_READ, PAYMENTS_READ, PayrollTab, SENSITIVE_RESULTS } from '../domain/payroll-sections';
import { PayrollApi } from '../infrastructure/payroll-api.service';
import { PayrollResultsComponent } from './payroll-results.component';
import { payrollQuery } from './payroll-ui';

type Evidence =
  | { tab: 'summary'; value: PayrollSummary }
  | { tab: 'issues'; value: PayrollIssue[] }
  | { tab: 'approvals' | 'history'; value: PayrollApproval[] }
  | { tab: 'closing'; value: PayrollClosing[] }
  | { tab: 'payments'; value: PayrollInstruction[] };

@Component({
  selector: 'app-payroll-evidence', standalone: true,
  imports: [NgTemplateOutlet, ComponentCardComponent, PayrollResultsComponent], templateUrl: './payroll-evidence.component.html',
})
export class PayrollEvidenceComponent {
  readonly context = input.required<CompanyWorkspace>();
  readonly run = input.required<PayrollRun>();
  readonly tab = input.required<PayrollTab>();
  readonly revision = input.required<number>();
  private readonly api = inject(PayrollApi);
  private readonly retries = signal(0);
  protected readonly date = payrollDate;
  protected readonly label = payrollLabel;
  protected readonly money = payrollMoney;
  protected readonly data = payrollQuery(computed(() => ({
    context: this.context(), id: this.run().id, version: this.run().version,
    tab: this.tab(), revision: this.revision(), retries: this.retries(),
  })), ({ context, id, tab }) => this.read(context, id, tab));

  protected refresh() { this.retries.update(retries => retries + 1); }

  private read(context: CompanyWorkspace, id: string, tab: PayrollTab): Observable<Evidence | null> {
    const company = context.company.id;
    switch (tab) {
      case 'summary': return this.api.runRead(company, id, 'summary').pipe(map(value => ({ tab, value })));
      case 'issues': return this.api.runRead(company, id, 'issues').pipe(map(value => ({ tab, value })));
      case 'approvals':
      case 'history':
        return context.permissions.includes(HISTORY_READ)
          ? this.api.runRead(company, id, 'history').pipe(map(value => ({ tab, value }))) : of(null);
      case 'closing':
        return context.permissions.includes(SENSITIVE_RESULTS)
          ? this.api.runRead(company, id, 'closing').pipe(map(value => ({ tab, value }))) : of(null);
      case 'payments':
        return context.permissions.includes(PAYMENTS_READ)
          ? this.api.runRead(company, id, 'payment-instructions').pipe(map(value => ({ tab, value }))) : of(null);
      case 'results': return of(null);
    }
  }
}
