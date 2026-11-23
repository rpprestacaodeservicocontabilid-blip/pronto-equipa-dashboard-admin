import { Component, DestroyRef, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { EMPTY, expand, finalize, forkJoin, of, reduce } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { CompanyWorkspace } from '../../../core/api/company-workspace-api';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { isPayrollId, payrollDate } from '../domain/payroll-format';
import { ExecutionScope, isAdjustment, NewRun, PayrollEmployee, RUN_TITLES, RunType } from '../domain/payroll.models';
import { canCreatePayrollRun, PayrollSection } from '../domain/payroll-sections';
import { PayrollApi } from '../infrastructure/payroll-api.service';
import { payrollQuery, payrollQueryParam, SubmissionKey } from './payroll-ui';

@Component({
  selector: 'app-payroll-run-form', standalone: true,
  imports: [FormsModule, RouterLink, ComponentCardComponent], templateUrl: './payroll-run-form.component.html',
})
export class PayrollRunFormComponent {
  readonly context = input.required<CompanyWorkspace>();
  readonly section = input.required<PayrollSection>();
  private readonly api = inject(PayrollApi);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly submission = new SubmissionKey();
  private readonly refreshCount = signal(0);
  private readonly initialPeriod = payrollQueryParam('period');
  private readonly initialOriginal = payrollQueryParam('original');
  protected readonly date = payrollDate;
  protected readonly titles = RUN_TITLES;
  protected readonly root = computed(() => ['/payroll', this.context().company.id, this.section().path]);
  protected readonly choices = computed(() => (this.section().create ?? [])
    .filter(type => canCreatePayrollRun(type, this.context().permissions)));
  protected readonly type = linkedSignal<RunType>(() => this.choices()[0] ?? 'REGULAR');
  protected readonly scope = linkedSignal<ExecutionScope>(() => this.section().scope ?? 'COLLECTIVE');
  protected readonly isAdjustment = computed(() => isAdjustment(this.type()));
  protected readonly periodId = linkedSignal(() => this.initialPeriod());
  protected readonly originalId = linkedSignal(() => this.initialOriginal());
  protected readonly selected = signal(new Map<string, string>());
  protected readonly selectionPreview = computed(() => Array.from(this.selected()).slice(0, 20));
  protected readonly failure = signal('');
  protected readonly busy = signal(false);
  protected readonly selecting = signal(false);
  protected readonly canBrowse = computed(() => this.context().permissions.includes('employees.read') && !this.isAdjustment());
  protected readonly employeePage = signal(1);
  protected readonly appliedSearch = signal('');
  protected readonly employeeSearchCount = signal(0);
  protected search = '';
  protected ids = '';
  protected reason = '';

  protected readonly references = payrollQuery(computed(() => ({
    company: this.context().company.id, adjustments: this.isAdjustment(), update: this.refreshCount(), allowed: this.choices().length > 0,
  })), ({ company, adjustments, allowed }) => allowed
    ? forkJoin({ periods: this.api.allPeriods(company), originals: adjustments ? this.api.allRuns(company) : of([]) })
    : of({ periods: [], originals: [] }));
  protected readonly originals = computed(() => {
    const state = this.references();
    return state && 'data' in state ? state.data.originals.filter(run => run.status === 'CLOSED') : [];
  });
  protected readonly original = computed(() => this.originals().find(run => run.id === this.originalId()));
  protected readonly employees = payrollQuery(computed(() => ({
    company: this.context().company.id, enabled: this.canBrowse(), page: this.employeePage(),
    search: this.appliedSearch(), refresh: this.employeeSearchCount(),
  })), ({ company, enabled, page, search }) => enabled ? this.api.employees(company, page, search) : of(null));

  protected clearSelection() { this.selected.set(new Map()); }
  protected changePage(delta: number) { this.employeePage.update(page => page + delta); }

  protected refresh() { this.refreshCount.update(value => value + 1); }
  protected searchEmployees() {
    this.employeePage.set(1);
    this.appliedSearch.set(this.search.trim());
    this.employeeSearchCount.update(value => value + 1);
  }
  protected changeType(type: RunType) {
    if (isAdjustment(type) !== this.isAdjustment()) this.selected.set(new Map());
    this.type.set(type);
  }
  protected changeScope(scope: ExecutionScope) {
    this.scope.set(scope);
    if (scope === 'INDIVIDUAL' && this.selected().size > 1) this.selected.set(new Map());
  }
  protected changeOriginal(id: string) {
    this.originalId.set(id);
    this.selected.set(new Map());
  }
  protected employeeName(employee: PayrollEmployee) {
    return (employee.firstName + ' ' + employee.lastName).trim() + ' · ' + employee.employeeNumber;
  }
  protected toggle(id: string, name = id) {
    this.selected.update(previous => {
      const updated = new Map(previous);
      if (updated.delete(id)) return updated;
      if (this.scope() === 'INDIVIDUAL') updated.clear();
      if (updated.size < 5000) updated.set(id, name);
      else this.failure.set('A run supports up to 5,000 employees.');
      return updated;
    });
  }
  protected addIds() {
    const ids = this.ids.trim().split(/[\s,;]+/).map(id => id.toLowerCase()).filter(Boolean);
    if (!ids.length || ids.some(id => !isPayrollId(id)) || (this.scope() === 'INDIVIDUAL' && ids.length !== 1)) {
      this.failure.set('Enter valid employee UUIDs matching the execution scope.');
      return;
    }
    this.applySelection(ids.map(id => [id, id]));
    this.ids = '';
  }
  protected selectOriginalEmployees() {
    const original = this.original();
    if (original && this.scope() === 'COLLECTIVE') this.applySelection(original.employeeIds.map(id => [id, id]));
  }
  protected selectActiveEmployees() {
    if (this.selecting() || this.scope() !== 'COLLECTIVE' || !this.canBrowse()) return;
    const company = this.context().company.id;
    this.failure.set('');
    this.selecting.set(true);
    this.api.employees(company, 1, '', true).pipe(
      expand(result => result.pagination.page < result.pagination.totalPages && result.pagination.page * result.pagination.limit < 5000
        ? this.api.employees(company, result.pagination.page + 1, '', true) : EMPTY),
      reduce((all, result) => {
        if (result.pagination.total > 5000) throw new Error('There are more than 5,000 active employees. Choose employees for separate batches.');
        all.push(...result.data);
        return all;
      }, [] as PayrollEmployee[]),
      takeUntilDestroyed(this.destroyRef), finalize(() => this.selecting.set(false)),
    ).subscribe({
      next: employees => {
        if (employees.length) this.applySelection(employees.map(employee => [employee.id, this.employeeName(employee)]));
        else this.failure.set('No active employees were found.');
      },
      error: error => this.failure.set(apiErrorMessage(error)),
    });
  }
  private applySelection(entries: [string, string][]) {
    const next = new Map(this.scope() === 'INDIVIDUAL' ? [] : this.selected());
    for (const [id, name] of entries) next.set(id, name);
    if (next.size > 5000) {
      this.failure.set('A run supports up to 5,000 employees.');
      return;
    }
    this.failure.set('');
    this.selected.set(next);
  }
  protected save() {
    if (this.busy() || this.selecting() || !this.choices().includes(this.type())) return;
    const references = this.references();
    const periodId = this.periodId();
    const original = this.original();
    const reason = this.reason.trim();
    const employeeIds = Array.from(this.selected().keys()).sort();
    if (!references || !('data' in references) || !references.data.periods.some(period => period.id === periodId && period.status === 'OPEN')) {
      this.failure.set('Select an open payroll period.');
      return;
    }
    if (!employeeIds.length || (this.scope() === 'INDIVIDUAL' && employeeIds.length !== 1)) {
      this.failure.set('Select employees matching the execution scope.');
      return;
    }
    if (this.isAdjustment() && (!original || !reason || employeeIds.some(id => !original.employeeIds.includes(id)))) {
      this.failure.set('Choose a closed original run, select its employees and provide a reason.');
      return;
    }
    const request: Omit<NewRun, 'idempotencyKey'> = {
      periodId, runType: this.type(), executionScope: this.scope(), employeeIds,
      ...(this.isAdjustment() && original ? { originalRunId: original.id, reason } : {}),
    };
    this.busy.set(true);
    this.failure.set('');
    this.api.createRun(this.context().company.id, { ...request, idempotencyKey: this.submission.for(request) }).pipe(
      takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false)),
    ).subscribe({
      next: run => {
        this.submission.clear();
        void this.router.navigate([...this.root(), run.id]);
      },
      error: error => this.failure.set(apiErrorMessage(error)),
    });
  }
}
