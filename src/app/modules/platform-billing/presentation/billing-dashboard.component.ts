import { Component, Input, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { money } from '../../../shared/utils/format-money';
import { downloadWorkbook, printReport, ReportDocument } from '../../../shared/utils/report-documents';
import { BillingOverview } from '../domain/billing.models';
import { ageingLabels, statusLabel } from './billing-display';

@Component({
  selector: 'app-billing-dashboard',
  standalone: true,
  imports: [RouterLink, ComponentCardComponent],
  templateUrl: './billing-dashboard.component.html',
  styleUrl: './billing-dashboard.component.css',
})
export class BillingDashboardComponent {
  @Input({ required: true }) set overview(value: BillingOverview) { this.data.set(value); }
  @Input() path = 'overview';
  @Input() companyId?: number;

  protected readonly data = signal<BillingOverview | null>(null);
  protected readonly currency = signal('AOA');
  protected readonly ageingLabels = ageingLabels;
  protected readonly money = money;
  protected readonly label = statusLabel;
  protected readonly total = computed(() => {
    const totals = this.data()?.totals ?? [];
    return totals.find(entry => entry.currency === this.currency()) ?? totals[0];
  });
  protected readonly invoiceStates = computed(() => Object.entries(this.data()?.invoiceStatuses ?? {}));
  protected readonly newest = computed(() => this.total()?.trend.at(-1));
  protected readonly kpi = computed(() => {
    const current = this.total();
    return current ? { invoiced: money(this.newest()?.invoiced ?? '0.00', current.currency),
      received: money(this.newest()?.received ?? '0.00', current.currency), outstanding: money(current.outstanding, current.currency) } : null;
  });
  protected readonly chartMax = computed(() => Math.max(1, ...(this.total()?.trend.flatMap(entry => [Number(entry.invoiced), Number(entry.received)]) ?? [])));
  protected readonly balanceMax = computed(() => Math.max(1, ...(this.total()?.ageing.map(Number) ?? [])));
  protected readonly toNumber = Number;
  protected readonly alerts: readonly {
    label: string; field: keyof BillingOverview['alerts']; path: string; status?: string;
  }[] = [
    { label: 'Overdue invoices', field: 'overdue', path: 'collections' },
    { label: 'Payments awaiting confirmation', field: 'pendingPayments', path: 'payments', status: 'PENDING' },
    { label: 'Failed processing events', field: 'failedEvents', path: 'events', status: 'DEAD' },
    { label: 'Unmatched bank entries', field: 'unmatched', path: 'bank-entries', status: 'UNMATCHED' },
  ];

  protected formatMonth(month: string) {
    return new Intl.DateTimeFormat('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(new Date(month + '-01T00:00:00Z'));
  }

  protected export(print = false) {
    const total = this.total();
    const data = this.data();
    if (!total || !data) return;
    const report: ReportDocument = {
      title: 'PRONTOEQUIPAS — ' + (this.path === 'ageing' ? 'Receivables ageing' : 'Billing and collections'),
      company: this.companyId ? 'Company #' + this.companyId : 'All platform companies',
      headings: this.path === 'ageing' ? ['Age', 'Currency', 'Outstanding'] : ['Month', 'Currency', 'Invoiced', 'Received'],
      rows: this.path === 'ageing'
        ? total.ageing.map((value, i) => [ageingLabels[i], total.currency, { amount: value, currency: total.currency }])
        : data.months.map((month, i) => [month, total.currency, { amount: total.trend[i].invoiced, currency: total.currency },
          { amount: total.trend[i].received, currency: total.currency }]),
    };
    if (print) printReport(report, money);
    else downloadWorkbook('platform-billing-' + this.path + '-' + total.currency, report);
  }
}
