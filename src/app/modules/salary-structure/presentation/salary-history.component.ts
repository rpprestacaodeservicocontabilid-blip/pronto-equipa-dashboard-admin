import { DatePipe } from '@angular/common';
import { Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { CompanyWorkspace } from '../../../core/api/company-workspace-api';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { TODAY, UUID, money, validDate } from '../domain/salary-format';
import { AssignedComponent, Assignment, EffectiveSalary, Snapshot } from '../domain/salary.models';
import { can } from '../domain/salary-sections';
import { SalaryApi } from '../infrastructure/salary-api.service';
import { SalaryFieldComponent } from './salary-field.component';
import { SalaryFormComponent } from './salary-form.component';
import { SalaryForm } from './salary-form';
import { employeeField } from './salary-pay-forms';

interface History { assignments: Assignment[]; components: AssignedComponent[] }
type ReadResult<T> = { data?: T; error?: string };

@Component({
  selector: 'app-salary-history',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, ComponentCardComponent, SalaryFieldComponent, SalaryFormComponent],
  templateUrl: './salary-history.component.html',
})
export class SalaryHistoryComponent implements OnInit {
  @Input({ required: true }) context!: CompanyWorkspace;
  @Input() initialEmployee = '';
  private readonly api = inject(SalaryApi);
  private readonly destroy = inject(DestroyRef);
  protected readonly history = signal<History | null>(null);
  protected readonly current = signal<EffectiveSalary | null>(null);
  protected readonly snapshot = signal<Snapshot | null>(null);
  protected readonly form = signal<SalaryForm | null>(null);
  protected readonly busy = signal(false);
  protected readonly errors = signal<string[]>([]);
  protected readonly field = employeeField;
  protected readonly money = money;
  protected readonly today = TODAY();
  protected employee = '';
  protected date = this.today;
  protected loadedEmployee = '';
  protected get company() { return this.context.company.id; }
  protected can(grant: string) { return can(this.context.permissions, grant); }

  ngOnInit() {
    if (UUID.test(this.initialEmployee)) { this.employee = this.initialEmployee; this.load(); }
  }
  protected setEmployee(value: string | boolean) { this.employee = String(value); }

  protected load() {
    if (this.busy() || this.form()) return;
    this.errors.set([]);
    if (!UUID.test(this.employee.trim()) || !validDate(this.date)) {
      this.errors.set(['Enter an employee ID and a valid reference date.']);
      return;
    }
    this.history.set(null);
    this.current.set(null);
    this.snapshot.set(null);
    this.loadedEmployee = this.employee.trim();
    this.busy.set(true);
    const optional = <T>(request: Observable<T>): Observable<ReadResult<T>> => request.pipe(map(data => ({ data })),
      catchError(error => of({ error: apiErrorMessage(error) })));
    const history: Observable<ReadResult<History>> = this.can('history:read') ? optional(this.api.history(this.company, this.loadedEmployee)) : of({});
    const current: Observable<ReadResult<EffectiveSalary>> = this.can('assignments:read') ? optional(this.api.current(this.company, this.loadedEmployee, this.date)) : of({});
    forkJoin({ history, current }).pipe(takeUntilDestroyed(this.destroy)).subscribe(result => {
      this.busy.set(false);
      if (result.history.data) this.history.set(result.history.data);
      if (result.current.data) this.current.set(result.current.data);
      this.errors.set([result.history, result.current].flatMap(part => part.error ? [part.error] : []));
    });
  }

  protected prepareSnapshot() {
    const employee = this.employee.trim();
    const date = this.date;
    if (!this.can('history:read') || !UUID.test(employee) || !validDate(date)) {
      this.errors.set(['Enter an employee ID and a valid reference date.']);
      return;
    }
    this.form.set({
      title: 'Resolve payroll snapshot',
      description: 'Employee ' + employee + ' · Effective on ' + date,
      fields: [], submitLabel: 'Resolve snapshot',
      confirm: 'I confirm that this effective-dated snapshot is required for payroll review.',
      send: () => this.api.snapshot(this.company, employee, date),
    });
  }

  protected saved(result: unknown) { this.form.set(null); this.snapshot.set(result as Snapshot); }
}
