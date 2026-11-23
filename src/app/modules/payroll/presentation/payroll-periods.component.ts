import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize, map, of } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { CompanyWorkspace } from '../../../core/api/company-workspace-api';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { payrollDate, payrollLabel } from '../domain/payroll-format';
import { PayrollPage, PayrollPeriod, PeriodDates } from '../domain/payroll.models';
import { PayrollApi } from '../infrastructure/payroll-api.service';
import { payrollConflict, payrollQuery } from './payroll-ui';

interface PeriodView { period?: PayrollPeriod; page?: PayrollPage<PayrollPeriod> }

@Component({
  selector: 'app-payroll-periods', standalone: true,
  imports: [FormsModule, RouterLink, NgTemplateOutlet, ComponentCardComponent], templateUrl: './payroll-periods.component.html',
})
export class PayrollPeriodsComponent {
  readonly context = input.required<CompanyWorkspace>();
  readonly periodId = input('');
  readonly creating = input(false);
  private readonly api = inject(PayrollApi);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly refreshCount = signal(0);
  protected readonly page = signal(1);
  protected readonly editing = signal<PayrollPeriod | null>(null);
  protected readonly confirming = signal(false);
  protected readonly busy = signal(false);
  protected readonly failure = signal('');
  protected readonly notice = signal('');
  protected readonly date = payrollDate;
  protected readonly label = payrollLabel;
  protected dates: PeriodDates = { startDate: '', endDate: '', paymentDate: '' };
  protected readonly root = computed(() => ['/payroll', this.context().company.id, 'periods']);
  protected readonly state = payrollQuery(computed(() => ({
    company: this.context().company.id, page: this.page(), id: this.periodId(),
    creating: this.creating(), refresh: this.refreshCount(),
  })), ({ company, page, id, creating }) => {
    if (creating) return of<PeriodView>({});
    return id ? this.api.period(company, id).pipe(map(period => ({ period })))
      : this.api.periods(company, page, 20).pipe(map(result => ({ page: result })));
  });

  protected allowed(action: string) { return this.context().permissions.includes('payroll:periods:' + action); }
  protected refresh() { this.refreshCount.update(value => value + 1); }
  protected edit(period: PayrollPeriod) {
    this.failure.set('');
    this.confirming.set(false);
    this.dates = { startDate: period.startDate, endDate: period.endDate, paymentDate: period.paymentDate };
    this.editing.set(period);
  }

  protected save() {
    if (this.busy() || !this.allowed(this.editing() ? 'update' : 'create')) return;
    const dates = this.dates;
    if (!dates.startDate || !dates.endDate || !dates.paymentDate || dates.startDate > dates.endDate) {
      this.failure.set('Enter three dates with the start on or before the end.');
      return;
    }
    const editing = this.editing() ?? undefined;
    this.busy.set(true);
    this.failure.set('');
    this.notice.set('');
    this.api.savePeriod(this.context().company.id, dates, editing).pipe(takeUntilDestroyed(this.destroyRef),
      finalize(() => this.busy.set(false))).subscribe({
      next: saved => {
        this.editing.set(null);
        if (editing) {
          this.notice.set('Period updated.');
          this.refresh();
        } else void this.router.navigate([...this.root(), saved.id]);
      },
      error: error => this.onError(error, Boolean(editing)),
    });
  }

  protected transition(period: PayrollPeriod, action: 'open' | 'close') {
    if (this.busy() || !this.allowed(action)) return;
    if (action === 'open' && period.status !== 'DRAFT') return;
    if (action === 'close' && (period.status !== 'OPEN' || !this.confirming())) return;
    this.failure.set('');
    this.notice.set('');
    this.busy.set(true);
    this.api.changePeriod(this.context().company.id, period, action).pipe(
      takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false)),
    ).subscribe({
      next: () => {
        this.confirming.set(false);
        this.notice.set(action === 'open' ? 'Period opened.' : 'Period closed.');
        this.refresh();
      },
      error: error => this.onError(error, true),
    });
  }

  private onError(error: unknown, refreshOnConflict: boolean) {
    this.failure.set(apiErrorMessage(error));
    if (refreshOnConflict && payrollConflict(error)) {
      this.editing.set(null);
      this.confirming.set(false);
      this.refresh();
    }
  }
}
