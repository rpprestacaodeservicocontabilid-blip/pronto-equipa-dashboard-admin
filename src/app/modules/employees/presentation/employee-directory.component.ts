import { DatePipe, DOCUMENT } from '@angular/common';
import { Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin, map } from 'rxjs';
import { employeeErrorMessage } from './employee-display';
import { ApiPage } from '../../../core/api/company-workspace-api';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { Employee, EmployeeFilter, EmployeeStatus, employeeStatuses, statusOptions } from '../domain/employee.models';
import { EmployeesApi } from '../infrastructure/employees-api.service';

const paths: Record<EmployeeStatus, string> = { ACTIVE: 'active', SUSPENDED: 'suspended', ON_LEAVE: 'on-leave', TERMINATED: 'departures' };

function currentAdmissionPeriod() {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Africa/Luanda', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts();
  const value = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const month = value['year'] + '-' + value['month'];
  return { admittedFrom: month + '-01', admittedTo: month + '-' + value['day'] };
}

@Component({
  selector: 'app-employee-directory', standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, ComponentCardComponent],
  templateUrl: './employee-directory.component.html',
})
export class EmployeeDirectoryComponent implements OnInit {
  protected readonly copy = {
    download: $localize`:@@employees-download-csv:Download CSV`,
    runReport: $localize`:@@employees-run-report:Run report`,
    search: $localize`:@@employees-search:Search`,
    workforce: $localize`:@@employees-workforce-by-status:Workforce by status`,
    report: $localize`:@@employees-workforce-report-by-admission-period:Workforce report by admission period`,
    export: $localize`:@@employees-export-employee-records:Export employee records`,
    directory: $localize`:@@employees-employee-directory:Employee directory`,
  };

  @Input({ required: true }) company = 0;
  @Input() view: 'overview' | 'directory' | 'exports' | 'reports' = 'directory';
  @Input() preset?: EmployeeStatus;
  @Input() admissions = false;
  private readonly api = inject(EmployeesApi);
  private readonly destroy = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  protected readonly labels = employeeStatuses;
  protected readonly statuses = statusOptions;
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly page = signal<ApiPage<Employee> | null>(null);
  protected readonly counts = signal<{ title: string; path: string; count: number }[]>([]);
  protected search = '';
  protected status: EmployeeStatus | '' = '';
  protected exportPage = 1;
  protected admittedFrom = '';
  protected admittedTo = '';
  protected departmentId: number | null = null;
  protected sort: EmployeeFilter['sort'] = 'name';
  private applied: EmployeeFilter = { page: 1, limit: 20 };

  ngOnInit() {
    if (this.admissions) {
      const period = currentAdmissionPeriod();
      this.admittedFrom = period.admittedFrom;
      this.admittedTo = period.admittedTo;
      this.sort = 'admission-desc';
    }
    if (this.view !== 'exports') this.load(1, true);
  }

  protected load(page = 1, apply = false) {
    if (this.loading()) return;
    this.error.set('');
    this.loading.set(true);
    if (this.view === 'overview' || this.view === 'reports') {
      const criteria = this.view === 'reports' ? this.filter(1, 1) : { page: 1, limit: 1 };
      if (!criteria) { this.loading.set(false); return; }
      const metrics = [
        { title: $localize`:@@employees-total-employees:Total employees`, path: 'all', filter: {} },
        ...statusOptions.map(status => ({ title: employeeStatuses[status], path: paths[status], filter: { status } })),
        ...(this.view === 'overview' ? [{ title: $localize`:@@employees-admissions-this-month:Admissions this month`, path: 'admissions', filter: currentAdmissionPeriod() }] : []),
      ];
      this.counts.set([]);
      forkJoin(metrics.map(({ title, path, filter }) => this.api.list(this.company, { ...criteria, ...filter })
        .pipe(map(result => ({ title, path, count: result.pagination.total })))))
        .pipe(takeUntilDestroyed(this.destroy)).subscribe({
          next: result => { this.counts.set(result); this.loading.set(false); },
          error: error => this.fail(error),
        });
      return;
    }
    if (apply) {
      const filter = this.filter(1, 20);
      if (!filter) { this.loading.set(false); return; }
      this.applied = filter;
    }
    this.api.list(this.company, { ...this.applied, page, status: this.preset ?? this.applied.status })
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: result => { this.page.set(result); this.loading.set(false); },
        error: error => { this.page.set(null); this.fail(error); },
      });
  }

  protected download() {
    if (this.loading() || !Number.isSafeInteger(this.exportPage) || this.exportPage < 1) return;
    this.error.set('');
    const filter = this.filter(this.exportPage, 100);
    if (!filter) return;
    this.loading.set(true);
    this.api.export(this.company, filter)
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: blob => {
          const url = URL.createObjectURL(blob);
          const link = this.document.createElement('a');
          link.href = url;
          link.download = `employees-${this.company}-page-${this.exportPage}.csv`;
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          this.loading.set(false);
        },
        error: error => this.fail(error),
      });
  }

  private filter(page: number, limit: number): EmployeeFilter | undefined {
    if (this.admittedFrom && this.admittedTo && this.admittedFrom > this.admittedTo) {
      this.error.set($localize`:@@employees-end-date-must-be-on-or-after-start-date:End date must be on or after start date.`);
      return undefined;
    }
    if (this.departmentId !== null && (!Number.isSafeInteger(this.departmentId) || this.departmentId < 1 || this.departmentId > 2147483647)) {
      this.error.set($localize`:@@employees-enter-a-valid-department-id:Enter a valid department ID.`);
      return undefined;
    }
    return {
      page, limit, search: this.search.trim(), status: this.status || undefined,
      admittedFrom: this.admittedFrom || undefined, admittedTo: this.admittedTo || undefined,
      departmentId: this.departmentId ?? undefined, sort: this.sort,
    };
  }

  private fail(error: unknown) {
    this.error.set(employeeErrorMessage(error));
    this.loading.set(false);
  }
}
