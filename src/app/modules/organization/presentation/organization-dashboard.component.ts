import { Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';
import { CompanyWorkspace } from '../../../core/api/company-workspace-api';
import { apiErrorMessage } from '../../../core/api/api-error';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { ORGANIZATION_RESOURCES } from '../domain/organization.resources';
import { AuditEvent, Resource } from '../domain/organization.models';
import { isoDate } from '../domain/organization-validation';
import { OrganizationApi } from '../infrastructure/organization-api.service';

const RESOURCES: Resource[] = ['departments', 'job-functions', 'job-positions', 'cost-centers', 'establishments', 'schedules'];
const LINKS = [
  { path: 'structure', label: 'Organization hierarchy', detail: 'Department relationships and leadership' },
  { path: 'departments', label: 'Departments', detail: 'Units, managers and employee assignments' },
  { path: 'job-functions', label: 'Job functions and positions', detail: 'Responsibilities and organizational roles' },
  { path: 'cost-centers', label: 'Cost centers', detail: 'Hierarchy and cost allocations' },
  { path: 'establishments', label: 'Establishments', detail: 'Sites and associated departments' },
  { path: 'calendars', label: 'Work calendars', detail: 'Workdays, holidays and exceptions' },
  { path: 'schedules', label: 'Schedules and shifts', detail: 'Working times and assignments' },
];

@Component({
  selector: 'app-organization-dashboard',
  standalone: true,
  imports: [RouterLink, DatePipe, ComponentCardComponent],
  templateUrl: './organization-dashboard.component.html',
})
export class OrganizationDashboardComponent implements OnInit {
  @Input({ required: true }) context!: CompanyWorkspace;
  private readonly api = inject(OrganizationApi);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly metrics = signal<{ resource: Resource; label: string; total: number; active: number }[]>([]);
  protected readonly indicators = signal<{ label: string; value: number | null; resource: Resource }[]>([]);
  protected readonly events = signal<AuditEvent[] | null>(null);
  protected readonly eventError = signal('');
  protected readonly links = LINKS;

  ngOnInit() { this.load(); }

  protected load() {
    const company = this.context.company.id;
    const today = isoDate(new Date());
    this.loading.set(true);
    this.error.set('');
    this.eventError.set('');
    this.events.set(null);
    forkJoin(RESOURCES.map(resource => forkJoin({
      total: this.api.page(company, resource, {}, 1, 1).pipe(map(page => page.pagination.total)),
      active: this.api.page(company, resource, { status: 'ACTIVE' }, 1, 1).pipe(map(page => page.pagination.total)),
    }).pipe(map(count => ({ resource, label: ORGANIZATION_RESOURCES[resource].label, ...count })))))
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: counts => { this.metrics.set(counts); this.loading.set(false); },
        error: error => { this.error.set(apiErrorMessage(error)); this.loading.set(false); },
      });

    forkJoin({
      departments: this.inactive(company, 'departments'),
      centers: this.inactive(company, 'cost-centers'),
      sites: this.inactive(company, 'establishments'),
      schedules: this.api.all(company, 'schedules', { status: 'ACTIVE' }).pipe(
        map(rows => rows.filter(row => !row.effectiveFrom || row.effectiveFrom > today || !!row.effectiveTo && row.effectiveTo < today).length),
        catchError(() => of(null)),
      ),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(counts => this.indicators.set([
      { label: 'Inactive departments', value: counts.departments, resource: 'departments' },
      { label: 'Inactive cost centers', value: counts.centers, resource: 'cost-centers' },
      { label: 'Inactive establishments', value: counts.sites, resource: 'establishments' },
      { label: 'Active schedules outside their effective dates', value: counts.schedules, resource: 'schedules' },
    ]));
    if (this.context.permissions.includes('audit:records:read-tenant')) {
      this.api.audit(company, 'Review recent organization changes on the dashboard', undefined, undefined, 5)
        .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: page => this.events.set(page.data),
          error: error => this.eventError.set(apiErrorMessage(error)),
        });
    }
  }

  private inactive(companyId: number, resource: Resource) {
    return this.api.page(companyId, resource, { status: 'INACTIVE' }, 1, 1).pipe(
      map(page => page.pagination.total), catchError(() => of(null)),
    );
  }
}
