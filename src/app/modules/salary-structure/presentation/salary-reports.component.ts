import { Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, Subject, catchError, map, of, switchMap } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { CompanyWorkspace } from '../../../core/api/company-workspace-api';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { ReportCell, downloadWorkbook, printReport } from '../../../shared/utils/report-documents';
import { UUID, human, money } from '../domain/salary-format';
import { Assignment, CatalogRecord, Query, Report, Revision } from '../domain/salary.models';
import { can } from '../domain/salary-sections';
import { SalaryApi } from '../infrastructure/salary-api.service';

type ReportView = Report | 'assignments';
type Row = CatalogRecord | Revision | Assignment;
type View = { rows: Row[]; total: number; complete?: boolean };
const REPORTS: { key: ReportView; title: string; grant?: string }[] = [
  { key: 'components', title: 'Component catalog' }, { key: 'structures', title: 'Structure catalog' },
  { key: 'assignments', title: 'Salary assignments', grant: 'assignments:read' },
  { key: 'revisions', title: 'Salary revisions', grant: 'revisions:read' },
];

@Component({
  selector: 'app-salary-reports',
  standalone: true,
  imports: [FormsModule, RouterLink, ComponentCardComponent],
  templateUrl: './salary-reports.component.html',
})
export class SalaryReportsComponent implements OnInit {
  @Input({ required: true }) context!: CompanyWorkspace;
  private readonly api = inject(SalaryApi);
  private readonly destroy = inject(DestroyRef);
  private readonly reload = new Subject<void>();
  protected readonly view = signal<View | null>(null);
  protected readonly busy = signal(false);
  protected readonly exporting = signal(false);
  protected readonly error = signal('');
  protected readonly inputError = signal('');
  protected readonly notice = signal('');
  protected readonly human = human;
  protected readonly money = money;
  protected report: ReportView = 'components';
  protected filter = { code: '', employeeId: '', status: '', from: '', to: '' };
  protected page = 1;
  private applied: Query = {};
  protected get company() { return this.context.company.id; }
  protected get options() { return REPORTS.filter(report => !report.grant || this.can(report.grant)); }
  protected get employeeReport() { return this.report === 'revisions' || this.report === 'assignments'; }
  protected get title() { return REPORTS.find(option => option.key === this.report)!.title; }
  protected can(grant: string) { return can(this.context.permissions, grant); }
  protected isRevision(row: Row): row is Revision { return 'proposedData' in row; }
  protected isAssignment(row: Row): row is Assignment { return 'contractId' in row; }

  ngOnInit() {
    this.reload.pipe(switchMap(() => {
      this.busy.set(true);
      this.error.set('');
      this.view.set(null);
      return this.read(false).pipe(map(view => ({ view })), catchError(error => of({ error: apiErrorMessage(error) })));
    }), takeUntilDestroyed(this.destroy)).subscribe(result => {
      this.busy.set(false);
      if ('error' in result) this.error.set(result.error); else this.view.set(result.view);
    });
    this.apply();
  }
  protected choose(report: ReportView) {
    if (!this.options.some(option => option.key === report) || this.exporting()) return;
    this.report = report;
    this.filter = { code: '', employeeId: '', status: '', from: '', to: '' };
    this.apply();
  }
  protected apply() {
    if (this.exporting()) return;
    const { code, employeeId, from, to, status } = this.filter;
    const issue = employeeId.trim() && !UUID.test(employeeId.trim()) ? 'Enter a valid employee ID.'
      : from && to && from > to ? 'The start date must be on or before the end date.' : '';
    this.inputError.set(issue);
    if (issue) return;
    this.applied = {
      ...(code.trim() && this.report === 'components' ? { code: code.trim() } : {}),
      ...(this.employeeReport && employeeId.trim() ? { employeeId: employeeId.trim() } : {}),
      ...(status ? { status } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}),
    };
    this.notice.set('');
    this.page = 1;
    this.retry();
  }
  protected retry() { this.reload.next(); }
  protected go(page: number) { this.page = page; if (!this.view()?.complete) this.retry(); }
  protected visible(view: View) { return view.complete ? view.rows.slice((this.page - 1) * 20, this.page * 20) : view.rows; }
  protected csv() {
    if (!this.can('export') || this.exporting() || this.report === 'assignments') return;
    this.exporting.set(true);
    this.error.set('');
    this.notice.set('');
    this.api.requestExport(this.company, this.report, this.applied).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: value => { this.exporting.set(false); this.notice.set('CSV request ' + value.exportId + ' · Pending.'); },
      error: error => { this.exporting.set(false); this.error.set(apiErrorMessage(error)); },
    });
  }
  protected export(view: View, format: 'excel' | 'pdf') {
    if (!this.can('export') || this.exporting()) return;
    this.error.set('');
    if (view.complete || view.total <= view.rows.length) { this.document(view, format); return; }
    this.exporting.set(true);
    this.read(true).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: data => { this.exporting.set(false); this.document(data, format); },
      error: error => { this.exporting.set(false); this.error.set(apiErrorMessage(error)); },
    });
  }

  private read(all: boolean): Observable<View> {
    const { from, to, ...query } = this.applied;
    const resource = this.report === 'assignments' ? 'assignments' : `reports/${this.report}` as const;
    const get = (page: number, limit: number) => this.api.page<Row>(this.company, resource, query, page, limit);
    if (!all && !from && !to) return get(this.page, 20).pipe(map(result => ({ rows: result.data, total: result.total })));
    return this.api.all(page => get(page, 100)).pipe(map(rows => rows.filter(row => {
      const day = this.isRevision(row) || this.isAssignment(row) ? row.effectiveFrom : row.createdAt.slice(0, 10);
      return (!from || day >= from) && (!to || day <= to);
    })), map(rows => ({ rows, total: rows.length, complete: true })));
  }
  private document(view: View, format: 'excel' | 'pdf') {
    const headings = this.report === 'revisions'
      ? ['Revision ID', 'Employee ID', 'Effective from', 'Status', 'Proposed base salary', 'Currency']
      : this.report === 'assignments'
        ? ['Assignment ID', 'Employee ID', 'Contract ID', 'Structure version', 'Effective from', 'Effective through', 'Base salary', 'Currency']
        : ['Code', 'Name', 'Status', 'Version'];
    const rows: ReportCell[][] = view.rows.map(row => this.isRevision(row)
      ? [row.id, row.employeeId, row.effectiveFrom, human(row.status),
        { amount: String(row.proposedData.baseSalary), currency: row.proposedData.currency }, row.proposedData.currency]
      : this.isAssignment(row) ? [row.id, row.employeeId, row.contractId, row.structureVersionId, row.effectiveFrom, row.effectiveTo,
        { amount: String(row.baseSalary), currency: row.currency }, row.currency]
        : [row.code, row.name, human(row.status), row.version]);
    const report = { title: this.title, company: this.context.company.name, headings, rows };
    if (format === 'excel') downloadWorkbook('salary-' + this.report, report);
    else printReport(report, money);
  }
}
