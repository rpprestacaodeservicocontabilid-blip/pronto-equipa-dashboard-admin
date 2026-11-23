import { DOCUMENT } from '@angular/common';
import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, firstValueFrom, map, Observable, of, startWith, switchMap } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { AuthService } from '../../../core/auth/auth.service';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { PageBreadcrumbComponent } from '../../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { money } from '../../../shared/utils/format-money';
import { actionBody, actionsFor, BillingAction, FormValues, mainActions, newBillingLine } from '../domain/billing-actions';
import { BillingAccount, BillingCursor, BillingFilters, BillingLine, BillingOverview, BillingPage, BillingRecord } from '../domain/billing.models';
import { BillingSection } from '../domain/billing-navigation';
import { PlatformBillingApi } from '../infrastructure/billing-api.service';
import { BillingDashboardComponent } from './billing-dashboard.component';
import { cell, columns, detailColumns, statusLabel, statuses, statusTone } from './billing-display';

interface State<T> { loading?: boolean; error?: string; data?: T }
type Result = BillingOverview | BillingPage | BillingAccount[];
interface ListRequest { filters: BillingFilters; cursors: (BillingCursor | undefined)[] }
interface ActionForm {
  action: BillingAction;
  record?: BillingRecord;
  companyId: number | null;
  values: FormValues;
  lines: BillingLine[];
  operationKey: string;
}
interface Selection { id: string; companyId: number }
const initial: State<Result> = {};
const companyIdIsValid = (value: number | null) => value !== null && Number.isInteger(value) && value > 0 && value <= 2147483647;
const toState = <T>(request: Observable<T>): Observable<State<T>> => request.pipe(
  map(data => ({ data })), catchError(error => of({ error: apiErrorMessage(error) })), startWith({ loading: true }),
);
const related = {
  invoiceId: 'invoices', originalInvoiceId: 'invoices', paymentId: 'payments', entryId: 'bank-entries',
} as Record<string, string>;

@Component({
  selector: 'app-billing-workspace',
  standalone: true,
  imports: [FormsModule, RouterLink, PageBreadcrumbComponent, ComponentCardComponent, BillingDashboardComponent],
  templateUrl: './billing-workspace.component.html',
  styleUrl: './billing-workspace.component.css',
})
export class BillingWorkspaceComponent {
  private readonly api = inject(PlatformBillingApi);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly document = inject(DOCUMENT);
  protected readonly section: BillingSection = this.route.snapshot.data['section'];
  protected readonly kind = this.section.kind;
  protected readonly columns = this.kind ? columns[this.kind] : [];
  protected readonly details = this.kind ? [...this.columns, ...(detailColumns[this.kind] ?? [])] : [];
  protected readonly statuses = this.kind && !this.section.preset?.overdue ? statuses[this.kind] ?? [] : [];
  protected readonly mainAction = mainActions[this.section.path];
  protected readonly money = money;
  protected readonly label = statusLabel;
  protected readonly tone = statusTone;
  protected readonly cell = cell;
  protected readonly related = related;
  protected readonly accountLinks = [
    { label: 'Invoices', path: 'invoices' }, { label: 'Payments', path: 'payments' },
    { label: 'Credits', path: 'credit-notes' }, { label: 'Details', path: 'billing-accounts' },
  ];
  protected companyId: number | null = null;
  protected status = '';
  protected search = '';
  protected from = '';
  protected to = '';
  protected readonly validation = signal('');
  protected readonly notice = signal('');
  protected readonly actionError = signal('');
  protected readonly busy = signal(false);
  protected form?: ActionForm;

  private readonly query = signal<ListRequest>({ filters: {}, cursors: [undefined] });
  protected readonly applied = this.query.asReadonly();
  protected readonly state = toSignal(toObservable(this.query).pipe(
    switchMap(({ filters, cursors }): Observable<State<Result>> => {
      if (this.kind) return toState(this.api.records(this.kind, filters, cursors[cursors.length - 1]));
      if (this.section.path === 'accounts') return toState(this.api.accounts(filters.companyId, filters.reference));
      return toState(this.api.overview(filters.companyId));
    }),
  ), { initialValue: initial });
  protected readonly page = computed(() => this.state().data as BillingPage | undefined);
  protected readonly overview = computed(() => this.state().data as BillingOverview | undefined);
  protected readonly accounts = computed(() => this.state().data as BillingAccount[] | undefined);
  protected readonly selection = signal<Selection | null>(null);
  private readonly detailState = toSignal(toObservable(this.selection).pipe(
    switchMap(selection => selection && this.kind
      ? toState(this.api.detail(selection.companyId, this.kind, selection.id)) : of(null)),
  ), { initialValue: null as State<BillingRecord> | null });
  protected readonly detail = this.detailState;
  private readonly detailRegion = viewChild('billingRecord', { read: ElementRef });
  protected readonly rowActions = computed(() => {
    const record = this.detail()?.data;
    return record ? actionsFor(record, this.auth.claims()?.sub) : [];
  });

  constructor() {
    effect(() => this.detailRegion()?.nativeElement.focus());
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => {
      const companyId = Number(params.get('companyId')) || null;
      this.companyId = companyIdIsValid(companyId) ? companyId : null;
      const status = params.get('status') ?? '';
      this.status = this.statuses.includes(status) ? status : '';
      this.applyFilters();
      const id = params.get('record');
      if (id && this.companyId) this.selection.set({ id, companyId: this.companyId });
    });
  }

  protected applyFilters() {
    this.validation.set('');
    if (this.companyId !== null && !companyIdIsValid(this.companyId)) {
      this.validation.set('Enter a valid company ID.');
      return;
    }
    if (this.from && this.to && this.from > this.to) {
      this.validation.set('The end date must be on or after the start date.');
      return;
    }
    this.closeRecord();
    this.query.set({
      filters: { ...this.section.preset, companyId: this.companyId ?? undefined, status: this.status || undefined,
        reference: this.search.trim() || undefined, from: this.from || undefined, to: this.to || undefined },
      cursors: [undefined],
    });
  }

  protected reset() {
    this.companyId = null;
    this.search = this.status = this.from = this.to = '';
    this.applyFilters();
  }

  protected previous() {
    if (this.query().cursors.length > 1) this.query.update(query => ({ ...query, cursors: query.cursors.slice(0, -1) }));
  }

  protected next(cursor: BillingCursor) {
    this.query.update(query => ({ ...query, cursors: [...query.cursors, cursor] }));
  }

  protected select(record: BillingRecord) {
    if (this.busy()) return;
    this.form = undefined;
    this.notice.set('');
    this.selection.set({ id: record.id, companyId: record.companyId });
  }

  protected closeRecord() {
    this.selection.set(null);
    this.form = undefined;
  }

  protected refresh() {
    this.query.update(query => ({ ...query }));
    const selection = this.selection();
    if (selection) this.selection.set({ ...selection });
  }

  protected open(action: BillingAction, record?: BillingRecord) {
    if (this.busy()) return;
    this.notice.set('');
    this.actionError.set('');
    const companyId = record?.companyId ?? this.applied().filters.companyId ?? null;
    const values = Object.fromEntries((action.fields ?? []).map(field => [
      field.name, (action.id === 'account' && record ? String(record.data[field.name] ?? '') : field.default) ?? '',
    ]));
    this.form = { action, record, companyId, values, lines: action.lines ? [newBillingLine()] : [],
      operationKey: action.key ? crypto.randomUUID() : '' };
    this.document.defaultView?.requestAnimationFrame(() => this.document.getElementById('billing-action')?.focus());
  }

  protected async submit(form: ActionForm) {
    if (this.busy()) return;
    this.actionError.set('');
    if (!form.companyId || !companyIdIsValid(form.companyId)) {
      this.actionError.set('Select the company affected by this operation.');
      return;
    }
    this.busy.set(true);
    try {
      const body = actionBody(form.action, form.values, form.lines, form.operationKey, form.record);
      await firstValueFrom(this.api.apply(form.companyId, form.action.method ?? 'POST', form.action.path(form.record), body));
      this.form = undefined;
      this.notice.set('Operation recorded for company #' + form.companyId + '.');
      this.refresh();
    } catch (error) { this.actionError.set(apiErrorMessage(error)); }
    finally { this.busy.set(false); }
  }

  protected addLine(form: ActionForm) {
    form.lines.push(newBillingLine());
  }

  protected pdfAvailable(record: BillingRecord) {
    return ['INVOICE', 'RECEIPT', 'CREDIT_NOTE'].includes(record.kind) && record.status !== 'DRAFT';
  }

  protected async download(record: BillingRecord) {
    if (this.busy()) return;
    this.busy.set(true);
    this.actionError.set('');
    try {
      const blob = await firstValueFrom(this.api.pdf(record));
      const url = URL.createObjectURL(blob);
      const link = this.document.createElement('a');
      link.href = url;
      link.download = (String(record.data['number'] ?? record.id)).replaceAll(/[^a-zA-Z0-9_.-]/g, '-') + '.pdf';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { this.actionError.set(apiErrorMessage(error)); }
    finally { this.busy.set(false); }
  }

  protected lines(record: BillingRecord): Record<string, unknown>[] {
    return Array.isArray(record.data['lines']) ? record.data['lines'] : [];
  }
  protected issuer(record: BillingRecord): Record<string, string> | null {
    const value = record.data['issuer'];
    return value && typeof value === 'object' ? value as Record<string, string> : null;
  }
}
