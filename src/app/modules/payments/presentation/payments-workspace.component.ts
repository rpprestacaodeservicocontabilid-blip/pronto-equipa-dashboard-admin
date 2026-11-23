import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, map, Observable, of, startWith, switchMap } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { AuthService } from '../../../core/auth/auth.service';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { PageBreadcrumbComponent } from '../../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import {
  Breakdown, PaymentDetail, PaymentDirectory, PaymentFilters, PaymentRow, PaymentReport,
  PaymentOverview, PaymentPage, Provider,
} from '../domain/payment.models';
import { canOpenPaymentSection, PAYMENT_PERMISSIONS, PAYMENT_SECTIONS, PaymentSection } from '../domain/payment-navigation';
import { PaymentsApi } from '../infrastructure/payments-api.service';
import {
  attemptColumns, columns, eventColumns, filtersByView, incidentStates, integrationHistoryColumns, label, money,
  relatedColumns, statusTone,
} from './payment-display';

interface Result<T> { loading?: boolean; error?: string; data?: T; }
type PaymentData = PaymentOverview | Provider[] | PaymentPage | PaymentReport;
const emptyResult: Result<PaymentData> = {};
interface RequestFilters {
  filters: PaymentFilters;
  purpose: string;
  breakdown: Breakdown;
  page: number;
}
const defaults: RequestFilters = { filters: {}, purpose: '', breakdown: 'status', page: 1 };
const auditMinimum = 5;
const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Luanda', dateStyle: 'medium', timeStyle: 'short',
});
const collect = <T>(request: Observable<T>): Observable<Result<T>> => request.pipe(
  map(data => ({ data })),
  catchError(error => of({ error: apiErrorMessage(error) })),
  startWith({ loading: true }),
);

@Component({
  selector: 'app-payments-workspace',
  standalone: true,
  imports: [FormsModule, NgTemplateOutlet, RouterLink, ComponentCardComponent, PageBreadcrumbComponent],
  templateUrl: './payments-workspace.component.html',
  styleUrl: './payments-workspace.component.css',
})
export class PaymentsWorkspaceComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly api = inject(PaymentsApi);
  private readonly auth = inject(AuthService);
  protected readonly section: PaymentSection = this.route.snapshot.data['section'];
  protected readonly view = this.section.view;
  protected readonly directory = Object.hasOwn(columns, this.view) ? this.view as PaymentDirectory : undefined;
  protected readonly columns = this.directory ? columns[this.directory] : [];
  protected readonly detailColumns = [
    ...this.columns,
    ...(this.directory ? relatedColumns[this.directory] ?? [] : []),
  ];
  protected readonly historyColumns = this.directory === 'integrations' ? integrationHistoryColumns
    : this.directory === 'orders' ? attemptColumns : eventColumns;
  protected readonly states = this.section.incident ? incidentStates[this.section.incident]
    : this.directory ? filtersByView[this.directory] ?? [] : [];
  protected readonly permissions = Object.entries(PAYMENT_PERMISSIONS);
  protected readonly granted = computed(() => this.auth.claims()?.permissions ?? []);
  protected readonly money = money;
  protected readonly label = label;
  protected readonly statusTone = statusTone;

  protected companyId: number | null = null;
  protected from = '';
  protected to = '';
  protected status = '';
  protected providerId = '';
  protected purpose = '';
  protected breakdown: Breakdown = 'status';
  protected readonly filterError = signal('');
  private readonly query = signal<RequestFilters>(defaults);
  private readonly records = toSignal(toObservable(this.query).pipe(
    switchMap(({ filters, page, breakdown, purpose }): Observable<Result<PaymentData>> => {
      switch (this.view) {
        case 'overview': return collect(this.api.overview(filters));
        case 'providers': return collect(this.api.providers());
        case 'reports': return collect(this.api.report(filters, page, breakdown));
        case 'settings': return of({});
        default:
          if (this.view === 'audit' && purpose.length < auditMinimum) return of({});
          return collect(this.api.list(this.view, filters, page, this.section.incident, purpose));
      }
    }),
  ), { initialValue: emptyResult });
  protected readonly result = this.records;
  protected readonly overview = computed(() => this.records().data as PaymentOverview | undefined);
  protected readonly providers = computed(() => this.records().data as Provider[] | undefined);
  protected readonly list = computed(() => this.records().data as PaymentPage | undefined);
  protected readonly report = computed(() => this.records().data as PaymentReport | undefined);
  protected readonly applied = this.query.asReadonly();
  private readonly selected = toSignal(this.route.queryParamMap.pipe(map(params => params.get('record'))));
  private readonly auditPurpose = computed(() => this.query().purpose);
  protected readonly detail = toSignal(toObservable(computed(() => ({
    id: this.selected(), purpose: this.auditPurpose(),
  }))).pipe(switchMap(({ id, purpose }) => (
    id && this.directory && (this.directory !== 'audit' || purpose.length >= auditMinimum)
      ? collect(this.api.detail(this.directory, id, purpose))
      : of(null)
  ))), { initialValue: null as Result<PaymentDetail> | null });

  protected search() {
    this.filterError.set('');
    if (this.companyId !== null && (!Number.isInteger(this.companyId) || this.companyId < 1 || this.companyId > 2147483647)) {
      this.filterError.set('Enter a valid company ID.');
      return;
    }
    if (this.from && this.to && this.from > this.to) {
      this.filterError.set('The end date must be on or after the start date.');
      return;
    }
    const purpose = this.purpose.trim();
    if (this.view === 'audit' && (purpose.length < auditMinimum || purpose.length > 500)) {
      this.filterError.set('Enter an audit purpose between 5 and 500 characters.');
      return;
    }
    this.query.set({
      filters: {
        companyId: this.companyId ?? undefined, from: this.from || undefined, to: this.to || undefined,
        providerId: this.view === 'reports' && this.breakdown !== 'provider' ? undefined : this.providerId.trim() || undefined,
        status: this.status || undefined,
      },
      purpose, breakdown: this.breakdown, page: 1,
    });
  }

  protected clear() {
    this.companyId = null;
    this.from = this.to = this.providerId = this.status = this.purpose = '';
    this.breakdown = 'status';
    this.filterError.set('');
    this.query.set(defaults);
    this.closeDetail();
  }

  protected changePage(page: number) {
    this.query.update(request => ({ ...request, page }));
  }

  protected refresh() {
    this.query.update(request => ({ ...request }));
  }

  protected openDetail(row: PaymentRow) {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { record: row.id }, queryParamsHandling: 'merge' })
      .then(navigated => {
        if (navigated) this.document.getElementById('payment-record')?.focus();
      });
  }

  protected closeDetail() {
    if (this.selected()) void this.router.navigate([], {
      relativeTo: this.route, queryParams: { record: null }, queryParamsHandling: 'merge', replaceUrl: true,
    });
  }

  protected display(row: PaymentRow, key: string) {
    const value = row[key];
    if (key === 'companyId') return row.companyName || (value == null ? 'Platform' : 'Company #' + value);
    if (value === undefined || value === null || value === '') return '—';
    if (key === 'amount' || key === 'totalAmount' || key === 'externalAmount') {
      return money(String(value), String(row[key === 'externalAmount' ? 'externalCurrency' : 'currency'] ?? ''));
    }
    if (key.endsWith('At') && typeof value === 'string') {
      const date = new Date(value);
      return Number.isFinite(date.getTime()) ? dateFormatter.format(date) : '—';
    }
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return ['status', 'paymentType', 'method', 'providerType'].includes(key) ? label(String(value)) : String(value);
  }

  protected linkFor(field: string): string | undefined {
    const path = { instructionId: 'company-payments', batchId: 'batches', orderId: 'orders', transactionId: 'transactions' }[field];
    const section = PAYMENT_SECTIONS.find(item => item.path === path);
    return section && canOpenPaymentSection(section, this.granted()) ? '/payments/' + path : undefined;
  }
}
