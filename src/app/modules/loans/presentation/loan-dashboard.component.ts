import { DatePipe } from '@angular/common';
import { Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, Subject, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { CompanyWorkspace } from '../../../core/api/company-workspace-api';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { cents, label, money, today } from '../domain/loans-format';
import { Application, Deduction, LoanSummary } from '../domain/loans.models';
import { hasGrant } from '../domain/loans-sections';
import { LoansApi } from '../infrastructure/loans-api.service';

interface Dashboard {
  summary?: LoanSummary;
  recent?: Application[];
  approvals?: number;
  disbursements?: number;
  suspended?: number;
  overdue?: number;
  deductions?: bigint;
}
interface GrantedMonth { month: string; amount: bigint; count: number }

@Component({
  selector: 'app-loan-dashboard',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, ComponentCardComponent],
  templateUrl: './loan-dashboard.component.html',
})
export class LoanDashboardComponent implements OnInit {
  @Input({ required: true }) context!: CompanyWorkspace;
  private readonly api = inject(LoansApi);
  private readonly destroy = inject(DestroyRef);
  private readonly reload = new Subject<void>();
  protected readonly data = signal<Dashboard | null>(null);
  protected readonly error = signal('');
  protected readonly dateError = signal('');
  protected readonly busy = signal(false);
  protected readonly loadingTrend = signal(false);
  protected readonly trendError = signal('');
  protected readonly trend = signal<GrantedMonth[] | null>(null);
  protected readonly label = label;
  protected readonly money = money;
  protected month = today().slice(0, 7);
  protected appliedMonth = this.month;
  protected get company() { return this.context.company.id; }
  protected can(grant: string) { return hasGrant(this.context.permissions, grant); }
  protected get monthBegin() { return this.appliedMonth + '-01'; }
  protected get monthEnd() {
    const [year, month] = this.appliedMonth.split('-').map(Number);
    return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  }

  ngOnInit() {
    this.reload.pipe(switchMap(() => {
      this.busy.set(true);
      this.error.set('');
      this.data.set(null);
      const errors: string[] = [];
      const optional = <T>(allowed: boolean, make: () => Observable<T>) => allowed ? make().pipe(catchError(error => {
        errors.push(apiErrorMessage(error));
        return of(undefined);
      })) : of(undefined);
      return forkJoin({
        summary: optional(this.can('reports.read'), () => this.api.summary(this.company)),
        recent: optional(this.can('applications.read'), () => this.api.applications(this.company, {}, 1, 5).pipe(map(response => response.data))),
        approvals: optional(this.can('applications.read'), () => this.api.applications(this.company, { status: 'PENDING_APPROVAL' }, 1, 1).pipe(map(response => response.total))),
        suspended: optional(this.can('loans.read'), () => this.api.loans(this.company, { status: 'SUSPENDED' }, 1, 1).pipe(map(response => response.total))),
        disbursements: optional(this.can('loans.read'), () => this.api.loans(this.company, { status: 'PENDING_DISBURSEMENT' }, 1, 1).pipe(map(response => response.total))),
        overdue: optional(this.can('reports.read'), () => this.api.overdue(this.company, 1, 1).pipe(map(response => response.total))),
        deductions: optional(this.can('deductions.read'), () => this.confirmedDeductions()),
      }).pipe(map(data => ({ data, errors })));
    }), takeUntilDestroyed(this.destroy)).subscribe(result => {
      this.busy.set(false);
      this.data.set(result.data);
      if (result.errors.length) this.error.set('Some indicators are unavailable. ' + result.errors[0]);
    });
    this.apply();
  }

  protected apply() {
    if (this.loadingTrend()) return;
    if (!/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(this.month)) { this.dateError.set('Select a valid month.'); return; }
    this.dateError.set('');
    if (this.appliedMonth !== this.month) this.trend.set(null);
    this.appliedMonth = this.month;
    this.reload.next();
  }

  protected loadTrend() {
    if (this.loadingTrend() || !this.can('loans.read')) return;
    this.loadingTrend.set(true);
    this.trendError.set('');
    const [year, month] = this.appliedMonth.split('-').map(Number);
    const months = new Map<string, GrantedMonth>();
    for (let offset = 5; offset >= 0; offset--) {
      const key = new Date(Date.UTC(year, month - 1 - offset, 1)).toISOString().slice(0, 7);
      months.set(key, { month: key, amount: 0n, count: 0 });
    }
    this.api.all(page => this.api.loans(this.company, {}, page, 100)).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: loans => {
        for (const loan of loans) {
          const period = loan.disbursedAt ? months.get(loan.disbursedAt.slice(0, 7)) : undefined;
          if (period) {
            period.amount += cents(loan.principalAmount) ?? 0n;
            period.count++;
          }
        }
        this.trend.set([...months.values()]);
        this.loadingTrend.set(false);
      },
      error: error => { this.trendError.set(apiErrorMessage(error)); this.loadingTrend.set(false); },
    });
  }

  protected share(amount: bigint, rows: GrantedMonth[]) {
    const largest = rows.reduce((max, row) => row.amount > max ? row.amount : max, 0n);
    return largest ? Number(amount * 100n / largest) : 0;
  }

  protected metrics(data: Dashboard) {
    const result: { title: string; value: number | string; path: string; query?: Record<string, string> }[] = [];
    if (this.can('reports.read')) result.push(
      { title: 'Loans in collection', value: data.summary?.activeLoans ?? '—', path: this.can('loans.read') ? 'active' : 'reports' },
      { title: 'Outstanding principal', value: money(data.summary?.outstandingPrincipal, data.summary?.currency), path: 'reports',
        query: { report: 'outstanding' } },
      { title: 'Overdue installments', value: data.overdue ?? '—', path: 'overdue' },
    );
    if (this.can('deductions.read')) result.push({
      title: 'Deductions confirmed in selected month', value: money(data.deductions), path: 'deductions',
      query: { from: this.monthBegin, to: this.monthEnd, confirmed: 'true' },
    });
    if (this.can('applications.read')) result.push({ title: 'Pending applications', value: data.approvals ?? '—', path: 'approvals' });
    if (this.can('loans.read')) result.push(
      { title: 'Awaiting disbursement', value: data.disbursements ?? '—',
        path: this.can('disbursements.read') || this.can('disbursements.request') ? 'disbursements' : 'active',
        query: { status: 'PENDING_DISBURSEMENT' } },
      { title: 'Suspended collections', value: data.suspended ?? '—', path: 'active', query: { status: 'SUSPENDED' } },
    );
    return result;
  }

  private confirmedDeductions() {
    const begin = this.monthBegin;
    const end = this.monthEnd;
    const lookup = (status: string) => this.api.all(page => this.api.deductions(this.company, { status }, page, 100));
    return forkJoin([lookup('CONFIRMED'), lookup('PARTIAL')]).pipe(map((states: Deduction[][]) =>
      states.flat().reduce((total, row) => {
        const date = row.updatedAt.slice(0, 10);
        return date >= begin && date <= end ? total + (cents(row.confirmedAmount) ?? 0n) : total;
      }, 0n),
    ));
  }
}
