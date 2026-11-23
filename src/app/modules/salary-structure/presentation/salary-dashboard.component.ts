import { Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, Subject, catchError, forkJoin, from, map, mergeMap, of, switchMap, toArray } from 'rxjs';
import { CompanyWorkspace } from '../../../core/api/company-workspace-api';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { OrganizationMembership } from '../../organization/infrastructure/organization-membership.service';
import { OrganizationFilterComponent } from '../../organization/presentation/organization-filter.component';
import { TODAY, effective, validDate } from '../domain/salary-format';
import { Assignment, Catalog, CatalogRecord, Revision } from '../domain/salary.models';
import { can } from '../domain/salary-sections';
import { SalaryApi } from '../infrastructure/salary-api.service';

interface Metric { label: string; path: string; value: number | string; status?: string }

@Component({
  selector: 'app-salary-dashboard',
  standalone: true,
  imports: [FormsModule, RouterLink, ComponentCardComponent, OrganizationFilterComponent],
  template: `
    <app-component-card title="Dashboard filters">
      <form class="space-y-4" (ngSubmit)="apply()">
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <label class="field">Reference date<input class="control" type="date" name="day" [(ngModel)]="date" required /></label>
          @if (peopleMetrics && context.permissions.includes('employees.read')) {
            <label class="field">Current job title<input class="control" name="job" maxlength="100" [(ngModel)]="job" /></label>
            <label class="field">Current professional category<input class="control" name="category" maxlength="100" [(ngModel)]="category" /></label>
          }
        </div>
        @if (peopleMetrics && context.permissions.includes('organization:read')) {
          <app-organization-filter [company]="company" (scopeChange)="departments = $event" />
        }
        @if (peopleMetrics) { <p class="text-sm text-gray-600 dark:text-gray-400">Organization filters apply to employee assignments and revisions.</p> }
        <button class="action action-primary" type="submit">Refresh indicators</button>
      </form>
      @if (error()) { <p class="feedback" role="alert">{{ error() }}</p> }
    </app-component-card>
    @if (busy()) { <p class="text-sm text-gray-600 dark:text-gray-400" role="status">Loading salary indicators…</p> }
    @if (metrics(); as cards) {
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        @for (card of cards; track card.label) {
          <a [routerLink]="['/salary-structure', company, card.path]" [queryParams]="{status: card.status}" class="rounded-2xl border border-gray-200 bg-white p-5 hover:border-brand-300 dark:border-gray-800 dark:bg-white/[0.03] dark:hover:border-brand-500">
            <p class="text-sm text-gray-600 dark:text-gray-400">{{ card.label }}</p>
            <p class="mt-2 text-title-sm font-semibold tabular-nums text-gray-900 dark:text-white">{{ card.value }}</p>
          </a>
        }
      </div>
      @if (cards.some(unavailable)) {
        <p class="text-sm text-gray-600 dark:text-gray-400" role="status">Some indicators are unavailable. Refresh to try again.</p>
      }
    }
  `,
})
export class SalaryDashboardComponent implements OnInit {
  @Input({ required: true }) context!: CompanyWorkspace;
  private readonly api = inject(SalaryApi);
  private readonly organization = inject(OrganizationMembership);
  private readonly destroy = inject(DestroyRef);
  private readonly dates = new Subject<string>();
  protected readonly metrics = signal<Metric[] | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly unavailable = (metric: Metric) => metric.value === '—';
  protected date = TODAY();
  protected job = '';
  protected category = '';
  protected departments: string[] | null = null;
  protected get company() { return this.context.company.id; }
  protected get peopleMetrics() { return this.can('assignments:read') || this.can('revisions:read'); }
  private can(grant: string) { return can(this.context.permissions, grant); }

  ngOnInit() {
    this.dates.pipe(switchMap(date => {
      this.busy.set(true);
      this.metrics.set(null);
      return this.scope(date).pipe(switchMap(employees => this.load(date, employees)),
        catchError(() => { this.error.set('Unable to apply the organization filters.'); return of([]); }));
    }), takeUntilDestroyed(this.destroy)).subscribe(metrics => { this.metrics.set(metrics); this.busy.set(false); });
    this.apply();
  }
  protected apply() {
    if (!validDate(this.date)) { this.error.set('Select a valid date.'); return; }
    this.error.set('');
    this.dates.next(this.date);
  }

  private load(date: string, employees: Set<string> | null): Observable<Metric[]> {
    const metrics: Observable<Metric[]>[] = [];
    const record = (path: string, label: string, source: Observable<number>, status?: string) => source.pipe(
      map(value => [{ label, path, value, status }]),
      catchError(() => of([{ label, path, value: '—', status }])),
    );
    if (this.can('read')) {
      metrics.push(record('components', 'Active component records', this.api.page(this.company, 'components', { status: 'ACTIVE' }, 1, 1).pipe(map(page => page.total))));
      metrics.push(record('tables', 'Published salary tables', this.catalogs('tables').pipe(map(rows => rows.filter(row =>
        row.versions.some(version => ['PUBLISHED', 'SUPERSEDED'].includes(version.status) && effective(version, date))).length))));
      metrics.push(this.catalogs('structures').pipe(map(rows => {
        const expiry = new Date(date + 'T00:00:00Z');
        expiry.setUTCDate(expiry.getUTCDate() + 30);
        const end = expiry.toISOString().slice(0, 10);
        const valid = (status: string) => ['PUBLISHED', 'SCHEDULED', 'SUPERSEDED'].includes(status);
        return [
          rows.filter(row => row.versions.some(version => valid(version.status) && effective(version, date))).length,
          rows.filter(row => row.versions.some(version => version.status === 'SCHEDULED' && version.effectiveFrom > date)).length,
          rows.filter(row => row.versions.some(version => valid(version.status) && effective(version, date) && version.effectiveTo && version.effectiveTo <= end)).length,
        ];
      }), catchError(() => of(['—', '—', '—'])), map(values => ['Effective pay structures', 'Future structures', 'Structures expiring within 30 days']
        .map((label, index) => ({ label, path: 'structures', value: values[index] })))));
    }
    if (this.can('assignments:read')) metrics.push(record('assignments', 'Employees with effective assignments',
      this.api.all(page => this.api.page<Assignment>(this.company, 'assignments', { status: 'ACTIVE' }, page, 100)).pipe(
        map(rows => new Set(rows.filter(row => effective(row, date) && (!employees || employees.has(row.employeeId))).map(row => row.employeeId)).size),
      )));
    if (this.can('revisions:read')) {
      const pending = employees
        ? this.api.all(page => this.api.page<Revision>(this.company, 'revisions', { status: 'PENDING_APPROVAL' }, page, 100)).pipe(
          map(rows => rows.filter(row => employees.has(row.employeeId)).length))
        : this.api.page(this.company, 'revisions', { status: 'PENDING_APPROVAL' }, 1, 1).pipe(map(page => page.total));
      metrics.push(record('revisions', 'Pending approvals',
        pending, 'PENDING_APPROVAL'));
      metrics.push(record('revisions', 'Future approved or applied revisions',
        forkJoin(['APPROVED', 'APPLIED'].map(status => this.api.all(page =>
          this.api.page<Revision>(this.company, 'revisions', { status }, page, 100)))).pipe(
          map(results => results.flat().filter(row => row.effectiveFrom > date && (!employees || employees.has(row.employeeId))).length),
        )));
    }
    return metrics.length ? forkJoin(metrics).pipe(map(results => results.flat())) : of([]);
  }
  private scope(date: string): Observable<Set<string> | null> {
    const job = this.job.trim().toLowerCase();
    const category = this.category.trim().toLowerCase();
    const memberships = this.organization.employees(this.company, this.departments, date);
    if (!job && !category) return memberships;
    return forkJoin({ memberships, directory: this.api.directory(this.company) }).pipe(map(({ memberships, directory }) =>
      new Set(directory.filter(employee => (!memberships || memberships.has(employee.id)) &&
        (!job || employee.jobTitle?.toLowerCase().includes(job)) &&
        (!category || employee.jobCategory?.toLowerCase().includes(category))).map(employee => employee.id)),
    ));
  }
  private catalogs(resource: Catalog) {
    return this.api.all(page => this.api.page<CatalogRecord>(this.company, resource, { status: 'ACTIVE' }, page, 100)).pipe(
      switchMap(rows => from(rows).pipe(mergeMap(row => this.api.catalog(this.company, resource, row.id), 4), toArray())),
    );
  }
}
