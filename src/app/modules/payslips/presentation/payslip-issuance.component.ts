import { Component, DestroyRef, EventEmitter, Input, OnInit, Output, PendingTasks, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { firstValueFrom, forkJoin, Observable } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { ChoicePage, ClosedRun, CompanyReceipt, EmployeeResult, Issuance, PublishedVersion, uuid } from '../domain/company-payslips.models';
import { label } from '../domain/payslip-supervision.models';
import { CompanyPayslipsApi } from '../infrastructure/company-payslips-api';

@Component({
  selector: 'app-payslip-issuance',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './payslip-issuance.component.html',
  styleUrl: './payslip-supervision.css',
})
export class PayslipIssuanceComponent implements OnInit {
  @Input({ required: true }) companyId!: number;
  @Input() batch = false;
  @Input() original: CompanyReceipt | null = null;
  @Input() saving = false;
  @Output() issue = new EventEmitter<Issuance>();

  private readonly api = inject(CompanyPayslipsApi);
  private readonly destroy = inject(DestroyRef);
  private readonly pending = inject(PendingTasks);
  protected readonly label = label;
  protected readonly errors = signal('');
  protected readonly busy = signal(false);
  protected readonly runs = signal<ChoicePage<ClosedRun>>({ items: [], more: false });
  protected readonly results = signal<ChoicePage<EmployeeResult>>({ items: [], more: false });
  protected readonly templates = signal<PublishedVersion[]>([]);
  protected readonly run = signal<ClosedRun | undefined>(undefined);
  protected readonly selected = signal<EmployeeResult[]>([]);
  protected templateId = '';
  protected employeeId = '';
  protected reason = '';
  protected resultsPage = 1;
  protected runsPage = 1;

  ngOnInit() { this.load(); }

  protected load() {
    void this.perform(async () => {
      const value = await this.request(forkJoin({
        runs: this.api.runs(this.companyId, 1),
        templates: this.api.versions(this.companyId),
      }));
      this.runsPage = 1;
      this.setRuns(value.runs);
      this.templates.set(value.templates);
    });
  }

  protected pageRuns(page: number) {
    void this.perform(async () => {
      this.setRuns(await this.request(this.api.runs(this.companyId, page)));
      this.runsPage = page;
    });
  }

  protected selectRun(id: string) {
    this.run.set(this.runs().items.find(row => row.id === id));
    this.selected.set([]);
    this.results.set({ items: [], more: false });
    this.employeeId = this.original?.employeeId ?? '';
    if (id) this.pageResults(1);
  }

  protected pageResults(page: number) {
    const run = this.run();
    if (!run) return;
    const worker = this.original?.employeeId ?? this.employeeId.trim();
    if (worker && !uuid.test(worker)) {
      this.errors.set('Enter a valid worker ID.');
      return;
    }
    void this.perform(async () => {
      const value = await this.request(this.api.results(this.companyId, run.id, page, worker || undefined));
      this.results.set(value);
      this.resultsPage = page;
    });
  }

  protected toggle(row: EmployeeResult, checked: boolean) {
    this.selected.update(rows => checked
      ? this.batch ? [...rows, row].slice(0, 500) : [row]
      : rows.filter(item => item.id !== row.id));
  }

  protected selectPage() {
    this.selected.update(rows => [...new Map([...rows, ...this.results().items].map(row => [row.id, row])).values()].slice(0, 500));
  }

  protected includes(id: string) { return this.selected().some(row => row.id === id); }

  protected submit() {
    const run = this.run();
    const reason = this.reason.trim();
    if (!run || !this.templateId || !this.selected().length || this.busy() || this.saving || (this.original && !reason)) return;
    this.issue.emit({ payrollRunId: run.id, templateVersionId: this.templateId,
      type: run.runType, results: this.selected(), reason: reason || undefined });
  }

  private setRuns(value: ChoicePage<ClosedRun>) {
    const original = this.original;
    this.runs.set({ more: value.more, items: value.items.filter(run =>
      original ? run.runType === 'CORRECTION' && run.originalRunId === original.payrollRunId : run.runType !== 'CORRECTION') });
  }

  private request<T>(stream: Observable<T>) {
    return firstValueFrom(stream.pipe(takeUntilDestroyed(this.destroy)));
  }

  private async perform(task: () => Promise<void>) {
    if (this.busy() || this.saving) return;
    this.busy.set(true);
    this.errors.set('');
    const done = this.pending.add();
    try { await task(); }
    catch (error) { if (!this.destroy.destroyed) this.errors.set(apiErrorMessage(error)); }
    finally { if (!this.destroy.destroyed) this.busy.set(false); done(); }
  }
}
