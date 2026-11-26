import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, PendingTasks, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable, firstValueFrom, forkJoin, of, skip, takeUntil } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { CompanyWorkspace } from '../../../core/api/company-workspace-api';
import { AuthService } from '../../../core/auth/auth.service';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { PageBreadcrumbComponent } from '../../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { CompanyPaymentContext } from '../company-payments.routes';
import { CompanyPaymentPage, CompanyPaymentPolicy, CompanyPaymentRow, CompanyPaymentSummary, CompanyProvider,
  Directory, StatementImport, paymentAmount, uuid } from '../domain/company-payments.models';
import { CompanyPaymentSection, companyPaymentAccess, companyPaymentSections } from '../domain/company-payments.navigation';
import { CompanyPaymentsApi } from '../infrastructure/company-payments-api';
import { Column, attemptColumns, columns, filtersByView, label, money, statusTone } from './payment-display';

type DetailPanel = 'beneficiary' | 'add' | 'execute' | 'decision' | 'account' | 'resolve';
type DirectoryColumn = Column;
const blankForm = () => ({
  employeeId: '', payrollResultId: '', code: '', source: '', bankCode: '', accountName: '', identifier: '',
  currency: 'AOA', primary: false, chosen: '', reason: '', evidence: '', acknowledged: false, providerStatus: 'ACTIVE',
});
const directoryColumns = (view: Directory): DirectoryColumn[] => view === 'bank-accounts'
  ? [{ key: 'accountName', label: $localize`:@@ui-oyp43g:Account` }, { key: 'bankCode', label: 'Bank' }, { key: 'accountIdentifier', label: 'Identifier' },
    { key: 'currency', label: $localize`:@@ui-5o3zh2:Currency` }, { key: 'status', label: $localize`:@@ui-3pd73:Status` }]
  : columns[view].filter(column => column.key !== 'companyId');
const detailViews: Directory[] = ['instructions', 'batches', 'orders', 'transactions', 'reconciliations'];

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, DecimalPipe, NgTemplateOutlet, ComponentCardComponent, PageBreadcrumbComponent],
  styleUrl: './payments-workspace.component.css',
  templateUrl: './company-payments.component.html',
})
export class CompanyPaymentsComponent {
  private readonly api = inject(CompanyPaymentsApi);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly destroy = inject(DestroyRef);
  private readonly pending = inject(PendingTasks);
  private revision = 0;
  protected readonly company = signal<CompanyWorkspace | null>(null);
  protected readonly section = signal<CompanyPaymentSection | undefined>(undefined);
  protected readonly denied = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly page = signal<CompanyPaymentPage | null>(null);
  protected readonly summary = signal<CompanyPaymentSummary | null>(null);
  protected readonly accounts = signal<CompanyPaymentRow[]>([]);
  protected readonly providers = signal<CompanyProvider[]>([]);
  protected readonly instructions = signal<CompanyPaymentPage | null>(null);
  protected readonly detail = signal<CompanyPaymentRow | null>(null);
  protected readonly activity = signal<CompanyPaymentRow[] | null>(null);
  protected readonly panel = signal<DetailPanel | null>(null);
  protected readonly statement = signal<StatementImport | null>(null);
  protected readonly statementFile = signal<File | null>(null);
  protected readonly currentPolicy = signal<CompanyPaymentPolicy | null>(null);
  protected readonly label = label;
  protected readonly money = money;
  protected readonly statusTone = statusTone;
  protected readonly attemptColumns = attemptColumns;
  protected readonly directory = computed(() => {
    const type = this.section()?.view;
    return type && !['overview', 'statements', 'policies', 'reports'].includes(type) ? type as Directory : undefined;
  });
  protected readonly columns = computed(() => {
    const directory = this.directory();
    return directory ? directoryColumns(directory) : [];
  });
  protected readonly states = computed(() => {
    const view = this.directory();
    if (!view) return [];
    if (view === 'bank-accounts') return ['VERIFIED', 'PENDING_VERIFICATION'];
    return filtersByView[view] ?? [];
  });
  protected status = '';
  protected form = blankForm();
  protected reportType = 'summary';
  protected reference = '';
  protected policy = { baseApprovals: 1, highValueThreshold: '', highValueApprovals: null as number | null };
  protected readonly chosenInstruction = computed(() => this.instructions()?.data ?? []);

  constructor() {
    this.route.data.pipe(takeUntilDestroyed(this.destroy)).subscribe(data => {
      this.revision++;
      this.reset();
      const access = data['access'] as CompanyPaymentContext;
      if ('error' in access) { this.denied.set(access.error); return; }
      this.company.set(access.context);
      const section = (data['section'] as CompanyPaymentSection | undefined)
        ?? companyPaymentSections.find(item => this.allowed(...item.grants));
      if (!section || !this.allowed(...section.grants)) {
        this.denied.set('Your company permissions do not include this payment workspace.');
        return;
      }
      this.section.set(section);
      this.reload(1);
    });
  }

  protected allowed(...grants: string[]) { return companyPaymentAccess(this.company()?.permissions ?? [], ...grants); }
  protected ownBatch(row: CompanyPaymentRow) { return String(row.createdBy) === this.auth.claims()?.sub; }
  protected canOpen(view: Directory) {
    return (view === 'instructions' ? this.allowed('payments:instructions:read') : detailViews.includes(view) || view === 'bank-accounts');
  }
  protected canPrepare(row: CompanyPaymentRow) { return ['PENDING_APPROVAL', 'APPROVED'].includes(row.status ?? ''); }
  protected canQuery(row: CompanyPaymentRow) { return ['SUBMITTED', 'PROCESSING', 'SUBMISSION_UNKNOWN'].includes(row.status ?? ''); }

  protected reload(page: number) {
    this.clear();
    void this.perform(id => this.load(id, page));
  }

  protected open(view: Directory, row: CompanyPaymentRow) {
    this.clear();
    void this.perform(async id => {
      this.detail.set(view === 'bank-accounts' ? row : await this.request(this.api.detail(id, view, row.id)));
    });
  }
  protected closeDetails() { this.clear(); }

  protected display(row: CompanyPaymentRow, key: string) {
    const value = row[key];
    if (value == null || value === '') return '—';
    if (key === 'status' || key === 'paymentType') return label(String(value));
    if (key === 'amount' || key === 'totalAmount' || key === 'externalAmount') {
      return money(String(value), String(row[key === 'externalAmount' ? 'externalCurrency' : 'currency'] ?? 'AOA'));
    }
    if (key === 'at' || key.endsWith('At')) {
      const date = new Date(String(value));
      if (!Number.isNaN(date.getTime())) return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'Africa/Luanda' }).format(date);
    }
    return String(value);
  }

  protected createInstruction() {
    const { payrollResultId, employeeId } = this.form;
    if (![payrollResultId, employeeId].every(value => uuid.test(value.trim()))) { this.error.set('Enter valid payroll result and worker IDs.'); return; }
    void this.mutate('/instructions', { payrollResultId: payrollResultId.trim(), employeeId: employeeId.trim() },
      'Instruction prepared from the closed payroll result.', 'POST', true);
  }

  protected createBatch() {
    if (!this.form.code.trim() || !uuid.test(this.form.source)) return;
    void this.mutate('/batches', { code: this.form.code.trim(), sourceAccountId: this.form.source },
      'Draft batch created.', 'POST', true);
  }

  protected setPanel(panel: DetailPanel) {
    this.panel.set(panel);
    this.form = blankForm();
    this.error.set('');
    if (panel === 'add') this.loadInstructions(1);
    if (panel === 'execute') {
      this.providers.set([]);
      void this.perform(async id => this.providers.set(await this.request(this.api.providers(id, true))));
    }
    if (panel === 'account') {
      const row = this.detail();
      if (row) this.form = { ...this.form, accountName: row.accountName ?? '', bankCode: row.bankCode ?? '',
        currency: row.currency ?? 'AOA', primary: row.isPrimary ?? false };
    }
  }

  protected loadInstructions(page: number) {
    this.form.chosen = '';
    void this.perform(async id => this.instructions.set(await this.request(this.api.list(id, 'instructions', page, 'PENDING_APPROVAL'))));
  }

  protected changeBeneficiary(row: CompanyPaymentRow) {
    const name = this.form.accountName.trim(), bankCode = this.form.bankCode.trim(), accountNumber = this.form.identifier.trim();
    if (!name || !bankCode || accountNumber.length < 3) return;
    void this.mutate('/instructions/' + row.id + '/beneficiary', { name, bankCode, accountNumber },
      'Beneficiary updated. The instruction requires approval.', 'PATCH', true);
  }

  protected addItem(row: CompanyPaymentRow) {
    const instruction = this.chosenInstruction().find(item => item.id === this.form.chosen);
    if (!instruction?.amount || instruction.currency !== row.currency) return;
    void this.perform(async id => {
      await this.request(this.api.write(id, '/batches/' + row.id + '/items', {
        instructionId: instruction.id, amount: String(instruction.amount),
      }));
      this.detail.set(await this.request(this.api.detail(id, 'batches', row.id)));
      this.panel.set(null);
      this.notice.set('Instruction included at its recorded amount.');
      await this.load(id, this.page()?.page ?? 1);
    });
  }

  protected batchAction(row: CompanyPaymentRow, action: 'validate' | 'submit' | 'approve' | 'reject' | 'execute') {
    const { chosen, reason, acknowledged } = this.form;
    if (action === 'execute' && (!acknowledged || !this.providers().some(provider => provider.id === chosen))) return;
    if (action === 'reject' && !reason.trim()) return;
    const body = action === 'execute' ? { providerId: chosen } : action === 'approve' || action === 'reject' ? { reason: reason.trim() } : {};
    void this.perform(async id => {
      await this.request(this.api.write(id, '/batches/' + row.id + '/' + action, body));
      this.panel.set(null);
      this.form = blankForm();
      this.detail.set(await this.request(this.api.detail(id, 'batches', row.id)));
      this.notice.set(action === 'execute' ? 'Execution requested. Check the recorded transfer statuses.' : 'Batch updated.');
      await this.load(id, this.page()?.page ?? 1);
    });
  }

  protected history(row: CompanyPaymentRow, view: 'instructions' | 'orders') {
    void this.perform(async id => {
      const events = view === 'orders' ? (await this.request(this.api.attempts(id, row.id))).attempts
        : (await this.request(this.api.history(id, row.id))).events;
      this.activity.set(events);
    });
  }

  protected refreshOrder(row: CompanyPaymentRow) {
    void this.perform(async id => {
      await this.request(this.api.write(id, '/orders/' + row.id + '/status', {}));
      this.detail.set(await this.request(this.api.detail(id, 'orders', row.id)));
      this.notice.set('Provider status retrieved.');
      await this.load(id, this.page()?.page ?? 1);
    });
  }

  protected cancelInstruction(row: CompanyPaymentRow) {
    if (!this.form.acknowledged) return;
    void this.mutate('/instructions/' + row.id + '/cancel', {}, 'Instruction cancelled.', 'POST', true);
  }

  protected saveAccount(row?: CompanyPaymentRow) {
    const { identifier, accountName, bankCode, currency, primary } = this.form;
    if (!accountName.trim() || !bankCode.trim() || !/^[A-Z]{3}$/.test(currency.toUpperCase()) ||
      (!row && identifier.trim().length < 3) || (identifier && identifier.trim().length < 3)) return;
    const body = row ? {
      ...(accountName.trim() !== row.accountName ? { accountName: accountName.trim() } : {}),
      ...(bankCode.trim() !== row.bankCode ? { bankCode: bankCode.trim() } : {}),
      ...(currency.toUpperCase() !== row.currency ? { currency: currency.toUpperCase() } : {}),
      ...(identifier.trim() ? { accountIdentifier: identifier.trim() } : {}),
      ...(primary !== row.isPrimary ? { isPrimary: primary } : {}),
    } : { accountName: accountName.trim(), bankCode: bankCode.trim(), currency: currency.toUpperCase(),
      accountIdentifier: identifier.trim(), isPrimary: primary };
    if (!Object.keys(body).length) return;
    void this.mutate('/bank-accounts' + (row ? '/' + row.id : ''), body,
      'Bank account saved.', row ? 'PATCH' : 'POST', !!row);
  }

  protected verifyAccount(row: CompanyPaymentRow) {
    if (!this.form.acknowledged) return;
    void this.mutate('/bank-accounts/' + row.id + '/verify', {}, 'Account verification recorded.', 'POST', true);
  }

  protected configureProvider() {
    const provider = this.providers().find(row => row.id === this.form.chosen);
    if (!provider) return;
    void this.mutate('/provider-configurations', { providerId: provider.id, providerType: provider.type,
      capabilities: provider.capabilities, status: this.form.providerStatus }, 'Provider configuration saved.');
  }

  protected setStatementFile(file: File | null) {
    this.statementFile.set(file);
    this.statement.set(null);
  }

  protected importStatement() {
    const file = this.statementFile();
    const sourceAccountId = this.form.source;
    if (!file || !uuid.test(sourceAccountId)) return;
    if (file.size > 10 * 1024 * 1024) { this.error.set('Choose a statement that fits the 10 MB API request limit.'); return; }
    void this.perform(async id => {
      let entries: unknown;
      try { entries = JSON.parse(await file.text()); }
      catch { throw new Error('The statement is not valid JSON.'); }
      if (!Array.isArray(entries) || !entries.length || entries.length > 10000)
        throw new Error('The JSON must contain an array of 1 to 10,000 statement entries.');
      if (id !== this.company()?.company.id || this.destroy.destroyed) return;
      this.statement.set(await this.request(this.api.statement(id, { sourceAccountId, entries, fileName: file.name })));
      this.notice.set('Statement entries imported.');
    });
  }

  protected reconcile() {
    if (!this.reference.trim()) return;
    void this.mutate('/reconciliations/run', { reference: this.reference.trim() }, 'Reconciliation result recorded.', 'POST', true);
  }

  protected resolve(row: CompanyPaymentRow) {
    const evidence = this.form.evidence.split(/[\n,]+/).map(value => value.trim()).filter(Boolean);
    if (!this.form.reason.trim() || !evidence.length || evidence.length > 20) {
      this.error.set('Enter a resolution note and up to 20 evidence references.');
      return;
    }
    void this.mutate('/reconciliations/' + row.id + '/resolve', { evidence, notes: this.form.reason.trim() },
      'Reconciliation exception resolved.', 'POST', true);
  }

  protected updatePolicy() {
    const { baseApprovals, highValueThreshold, highValueApprovals } = this.policy;
    const threshold = highValueThreshold.trim();
    if (!Number.isInteger(baseApprovals) || baseApprovals < 1 || baseApprovals > 10
      || (threshold ? !paymentAmount.test(threshold) || highValueApprovals == null || !Number.isInteger(highValueApprovals)
        || highValueApprovals < Math.max(2, baseApprovals) || highValueApprovals > 10 : highValueApprovals != null)) {
      this.error.set('Check the approval count and the paired high-value threshold and count.');
      return;
    }
    void this.perform(async id => {
      await this.request(this.api.write(id, '/policies', { baseApprovals,
        ...(threshold ? { highValueThreshold: threshold, highValueApprovals } : {}) }, 'PUT'));
      this.showPolicy(await this.request(this.api.policy(id)));
      this.notice.set('Approval policy updated.');
    });
  }

  protected exportReport() {
    void this.perform(async id => {
      const file = await this.request(this.api.export(id, this.reportType));
      this.download(new Blob([file.content], { type: 'text/csv;charset=utf-8' }), file.fileName);
    });
  }

  protected downloadReceipt(row: CompanyPaymentRow) {
    void this.perform(async id => {
      this.download(await this.request(this.api.receipt(id, row.id)), 'payment-' + row.id + '.pdf');
    });
  }

  private download(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private showPolicy(value: CompanyPaymentPolicy) {
    this.currentPolicy.set(value);
    this.policy = { baseApprovals: value.baseApprovals, highValueThreshold: value.highValueThreshold ?? '', highValueApprovals: value.highValueApprovals };
  }

  private async load(id: number, page: number) {
    const directory = this.directory();
    const section = this.section();
    if (directory) {
      const status = section?.status ?? this.status;
      const data = await this.request(forkJoin({
        page: this.api.list(id, directory, page, status),
        accounts: directory === 'batches' && this.allowed('payments:bank-accounts:read', 'payments:batches:create')
          ? this.api.accounts(id) : of([]),
        providers: directory === 'integrations' ? this.api.providers(id, false) : of([]),
      }));
      this.page.set(data.page);
      this.accounts.set(data.accounts.filter(row => row.status === 'VERIFIED'));
      this.providers.set(data.providers);
    } else if (section?.view === 'overview') this.summary.set(await this.request(this.api.summary(id)));
    else if (section?.view === 'statements') this.accounts.set((await this.request(this.api.accounts(id))).filter(row => row.status === 'VERIFIED'));
    else if (section?.view === 'policies') this.showPolicy(await this.request(this.api.policy(id)));
  }

  private async mutate(path: string, value: object, message: string, method = 'POST', showDetail = false) {
    await this.perform(async id => {
      const row = await this.request(this.api.write<CompanyPaymentRow>(id, path, value, method));
      this.panel.set(null);
      this.form = blankForm();
      if (showDetail) this.detail.set(row);
      this.notice.set(message);
      await this.load(id, this.page()?.page ?? 1);
    });
  }

  private clear() {
    this.detail.set(null); this.activity.set(null); this.panel.set(null); this.instructions.set(null); this.form = blankForm();
  }
  private reset() {
    this.company.set(null); this.section.set(undefined); this.denied.set(''); this.error.set(''); this.notice.set('');
    this.busy.set(false); this.page.set(null); this.summary.set(null); this.accounts.set([]); this.providers.set([]);
    this.statement.set(null); this.statementFile.set(null); this.currentPolicy.set(null); this.status = ''; this.reference = '';
    this.reportType = 'summary'; this.clear();
  }
  private async request<T>(stream: Observable<T>) {
    const revision = this.revision;
    const data = await firstValueFrom(stream.pipe(takeUntil(this.route.data.pipe(skip(1))), takeUntilDestroyed(this.destroy)));
    if (this.destroy.destroyed || revision !== this.revision) throw new Error('Company workspace changed.');
    return data;
  }
  private async perform(task: (company: number) => Promise<void>) {
    const id = this.company()?.company.id;
    if (!id || this.busy() || this.denied()) return;
    const revision = this.revision;
    const done = this.pending.add();
    this.error.set(''); this.notice.set(''); this.busy.set(true);
    try { await task(id); }
    catch (error) { if (!this.destroy.destroyed && revision === this.revision) this.error.set(apiErrorMessage(error)); }
    finally { if (!this.destroy.destroyed && revision === this.revision) this.busy.set(false); done(); }
  }
}
