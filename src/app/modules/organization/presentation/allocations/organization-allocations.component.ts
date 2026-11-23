import { DatePipe } from '@angular/common';
import { Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { ApiPage, CompanyWorkspace } from '../../../../core/api/company-workspace-api';
import { apiErrorMessage } from '../../../../core/api/api-error';
import { ComponentCardComponent } from '../../../../shared/components/common/component-card/component-card.component';
import { OrganizationRecord } from '../../domain/organization.models';
import { isoDate, validAllocation, validPeriod } from '../../domain/organization-validation';
import { EmployeeOption, OrganizationApi } from '../../infrastructure/organization-api.service';
import { OrganizationHistoryComponent } from '../history/organization-history.component';

interface AllocationDraft { key: number; costCenterId: string; percentage: number | null }

@Component({
  selector: 'app-organization-allocations',
  standalone: true,
  imports: [DatePipe, FormsModule, ComponentCardComponent, OrganizationHistoryComponent],
  templateUrl: './organization-allocations.component.html',
})
export class OrganizationAllocationsComponent implements OnInit {
  @Input({ required: true }) context!: CompanyWorkspace;
  @Input() centerId = '';

  private readonly api = inject(OrganizationApi);
  private readonly destroy = inject(DestroyRef);
  private nextKey = 2;
  protected readonly today = isoDate(new Date());
  protected readonly centers = signal<OrganizationRecord[]>([]);
  protected readonly employees = signal<EmployeeOption[]>([]);
  protected readonly rows = signal<ApiPage<OrganizationRecord> | null>(null);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly referenceError = signal('');
  protected readonly notice = signal('');
  protected readonly showForm = signal(false);
  protected readonly historyId = signal('');
  protected companyEmployee = '';
  protected from = this.today;
  protected to = '';
  protected filterCenter = '';
  protected drafts: AllocationDraft[] = [{ key: 1, costCenterId: '', percentage: 100 }];

  protected get canCreate() {
    return ['organization:cost-allocations:manage', 'employees.read'].every(grant => this.context.permissions.includes(grant));
  }
  protected get total() {
    return this.drafts.reduce((total, entry) => total + Math.round((entry.percentage ?? 0) * 100), 0) / 100;
  }

  ngOnInit() {
    this.filterCenter = this.centerId;
    this.load(1);
    this.loadReferences();
  }

  protected load(page: number) {
    this.loading.set(true);
    this.error.set('');
    this.api.page(this.context.company.id, 'cost-allocations', this.filterCenter ? { relatedId: this.filterCenter } : {}, page)
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: rows => { this.rows.set(rows); this.loading.set(false); },
        error: error => { this.error.set(apiErrorMessage(error)); this.loading.set(false); },
      });
  }

  protected loadReferences() {
    const companyId = this.context.company.id;
    this.referenceError.set('');
    this.api.all(companyId, 'cost-centers').pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: rows => this.centers.set(rows),
      error: error => this.referenceError.set(apiErrorMessage(error)),
    });
    if (this.context.permissions.includes('employees.read')) {
      this.api.employees(companyId).pipe(catchError(error => {
        this.referenceError.set(apiErrorMessage(error));
        return of([]);
      }), takeUntilDestroyed(this.destroy)).subscribe(rows => this.employees.set(rows));
    }
  }

  protected centerName(id: string | null | undefined) {
    return id ? this.centers().find(record => record.id === id)?.name ?? '—' : 'Unavailable';
  }

  protected employeeName(id: string | null | undefined) {
    const employee = this.employees().find(record => record.id === id);
    return employee ? employee.firstName + ' ' + employee.lastName : 'Unavailable';
  }

  protected add() {
    if (this.drafts.length < 50) this.drafts = [...this.drafts, { key: this.nextKey++, costCenterId: '', percentage: null }];
  }

  protected remove(key: number) {
    if (this.drafts.length > 1) this.drafts = this.drafts.filter(entry => entry.key !== key);
  }

  protected save() {
    if (!this.canCreate || this.busy()) return;
    this.error.set('');
    this.notice.set('');
    if (!this.companyEmployee || !validPeriod(this.from, this.to) || this.from < this.today || !validAllocation(this.drafts)) {
      this.error.set('Select an employee, enter a current or future period and allocate exactly 100% across distinct cost centers.');
      return;
    }
    this.busy.set(true);
    this.api.allocations(this.context.company.id, {
      employeeId: this.companyEmployee, effectiveFrom: this.from, effectiveTo: this.to || null,
      allocations: this.drafts.map(entry => ({ costCenterId: entry.costCenterId, percentage: entry.percentage! })),
    }).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: () => {
        this.busy.set(false);
        this.showForm.set(false);
        this.notice.set('Cost allocations saved for the selected period.');
        this.drafts = [{ key: this.nextKey++, costCenterId: '', percentage: 100 }];
        this.companyEmployee = '';
        this.load(1);
      },
      error: error => { this.error.set(apiErrorMessage(error)); this.busy.set(false); },
    });
  }
}
