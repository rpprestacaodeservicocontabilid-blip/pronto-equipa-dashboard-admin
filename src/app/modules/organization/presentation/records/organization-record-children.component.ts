import { DatePipe } from '@angular/common';
import { activeLocale } from '../../../../core/i18n/locale';
import { Component, DestroyRef, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, catchError, forkJoin, of } from 'rxjs';
import { CompanyWorkspace } from '../../../../core/api/company-workspace-api';
import { organizationErrorMessage, organizationOptionLabel } from '../organization-display';
import { ComponentCardComponent } from '../../../../shared/components/common/component-card/component-card.component';
import { OrganizationRecord, Resource, Shift } from '../../domain/organization.models';
import { MONDAY_FIRST, WEEKDAYS } from '../../domain/organization.resources';
import { isoDate, shiftValidation, validPeriod } from '../../domain/organization-validation';
import { EmployeeOption, OrganizationApi, childCollection } from '../../infrastructure/organization-api.service';

type TargetType = 'DEPARTMENT' | 'ESTABLISHMENT' | 'EMPLOYEE';
type FormKind = 'department' | 'exception' | 'shift' | 'scheduleAssignment';

@Component({
  selector: 'app-organization-record-children',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, ComponentCardComponent],
  templateUrl: './organization-record-children.component.html',
})
export class OrganizationRecordChildrenComponent implements OnInit {
  protected readonly labels = {
    manager: $localize`:@@organization-manager:Manager`,
    responsibleEmployee: $localize`:@@organization-responsible-employee:Responsible employee`,
    professionalCategory: $localize`:@@organization-professional-category:Professional category`,
    jobFunction: $localize`:@@organization-job-function:Job function`,
    associationUnavailable: $localize`:@@organization-association-unavailable-from-api:Association unavailable from API`,
    openEnded: $localize`:@@organization-open-ended:Open-ended`,
    date: $localize`:@@organization-date:Date`,
    effectiveFrom: $localize`:@@organization-effective-from:Effective from`,
    saving: $localize`:@@organization-saving:Saving…`,
    save: $localize`:@@organization-save:Save`,
  };

  @Input({ required: true }) context!: CompanyWorkspace;
  @Input({ required: true }) resource!: Resource;
  @Input({ required: true }) record!: OrganizationRecord;
  @Input() shiftsOnly = false;
  @Output() changed = new EventEmitter<void>();
  private readonly api = inject(OrganizationApi);
  private readonly destroy = inject(DestroyRef);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly referenceError = signal('');
  protected readonly notice = signal('');
  protected readonly form = signal<FormKind | null>(null);
  protected readonly rows = signal<OrganizationRecord[]>([]);
  protected readonly assignments = signal<OrganizationRecord[]>([]);
  protected readonly departments = signal<OrganizationRecord[]>([]);
  protected readonly sites = signal<OrganizationRecord[]>([]);
  protected readonly positions = signal<OrganizationRecord[]>([]);
  protected readonly categories = signal<OrganizationRecord[]>([]);
  protected readonly functions = signal<OrganizationRecord[]>([]);
  protected readonly employees = signal<EmployeeOption[]>([]);
  protected readonly today = isoDate(new Date());
  protected readonly weekdays = WEEKDAYS;
  protected readonly order = MONDAY_FIRST;
  protected readonly month = signal(this.today.slice(0, 7));
  protected readonly shifts = computed(() => {
    const value = this.record.data['shifts'];
    return Array.isArray(value) ? value as Shift[] : [];
  });
  protected readonly optionLabel = organizationOptionLabel;
  private readonly weekdayFormatter = new Intl.DateTimeFormat(activeLocale(), { weekday: 'short', timeZone: 'UTC' });

  protected shortWeekday(day: number) {
    return this.weekdayFormatter.format(new Date(Date.UTC(2024, 0, 7 + day)));
  }

  protected readonly monthName = computed(() => new Intl.DateTimeFormat(activeLocale(), {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(this.month() + '-01T00:00:00Z')));
  protected readonly monthCells = computed(() => {
    const date = new Date(this.month() + '-01T00:00:00Z');
    const offset = (date.getUTCDay() + 6) % 7;
    const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    const working = this.record.data['workingWeekdays'];
    const exceptions = new Map<string | null | undefined, OrganizationRecord>();
    for (const row of this.rows()) if (row.status === 'ACTIVE') exceptions.set(row.effectiveFrom, row);
    return Array.from({ length: offset + last }, (_, index) => {
      const day = index - offset + 1;
      if (day < 1) return null;
      const key = this.month() + '-' + String(day).padStart(2, '0');
      const weekday = (index + 1) % 7;
      const exception = exceptions.get(key);
      const effective = (!this.record.effectiveFrom || key >= this.record.effectiveFrom)
        && (!this.record.effectiveTo || key <= this.record.effectiveTo);
      const special = exception?.data['dayType'];
      const type = !effective ? $localize`:@@organization-outside-period:Outside period` : typeof special === 'string' ? this.optionLabel(special)
        : Array.isArray(working) && working.includes(weekday) ? $localize`:@@organization-working-day:Working day` : $localize`:@@organization-rest-day:Rest day`;
      return { key, day, type, name: exception?.name ?? '', holiday: special === 'HOLIDAY' && effective };
    });
  });
  protected name = '';
  protected from = this.today;
  protected to = '';
  protected employee = '';
  protected assignmentType = 'PRIMARY';
  protected position = '';
  protected dayType = 'HOLIDAY';
  protected description = '';
  protected weekday = 1;
  protected start = '08:00';
  protected end = '17:00';
  protected overnight = false;
  protected pause: number | null = 60;
  protected targetType: TargetType = 'DEPARTMENT';
  protected target = '';

  ngOnInit() {
    if (this.record.effectiveFrom && this.record.effectiveFrom > this.today) this.month.set(this.record.effectiveFrom.slice(0, 7));
    this.load();
  }

  protected get canReadEmployees() { return this.context.permissions.includes('employees.read'); }

  protected get canAddShift() {
    return this.can('schedules:manage') && this.record.status === 'ACTIVE'
      && (!this.record.effectiveFrom || this.record.effectiveFrom >= this.today);
  }

  protected get hasReferences() {
    return ['departments', 'establishments', 'cost-centers', 'job-functions', 'job-positions', 'schedules', 'calendars'].includes(this.resource);
  }

  protected can(permission: string) { return this.context.permissions.includes('organization:' + permission); }

  protected employeeLabel(id: unknown) {
    if (typeof id !== 'string' || !id) return '—';
    const employee = this.employees().find(entry => entry.id === id);
    return employee ? employee.firstName + ' ' + employee.lastName : $localize`:@@organization-assigned:Assigned`;
  }

  protected referenceLabel(records: OrganizationRecord[], id: unknown) {
    return typeof id === 'string' && id ? records.find(row => row.id === id)?.name ?? $localize`:@@organization-assigned:Assigned` : '—';
  }

  protected relatedDepartments() {
    return this.departments().filter(row => row.data['establishmentId'] === this.record.id);
  }

  protected targetLabel(record: OrganizationRecord) {
    const target = record.data['targetId'];
    if (record.data['targetType'] === 'EMPLOYEE') return this.employeeLabel(target);
    return this.referenceLabel(record.data['targetType'] === 'DEPARTMENT' ? this.departments() : this.sites(), target);
  }

  protected load() {
    const company = this.context.company.id;
    const id = this.record.id;
    const resource = this.resource;
    const child = resource === 'departments' ? this.api.all(company, childCollection(resource, id, 'employees'))
      : resource === 'calendars' ? this.api.all(company, childCollection(resource, id, 'exceptions'))
      : resource === 'schedules' ? this.api.all(company, childCollection(resource, id, 'shifts')) : of([]);
    this.loading.set(true);
    this.error.set('');
    this.referenceError.set('');
    forkJoin({
      rows: child,
      assignments: resource === 'schedules' && !this.shiftsOnly ? this.optional(this.api.all(company, 'schedule-assignments', { relatedId: id })) : of([]),
      departments: ['departments', 'establishments', 'job-positions', 'schedules'].includes(resource)
        ? this.optional(this.api.all(company, 'departments')) : of([]),
      sites: ['departments', 'cost-centers', 'calendars', 'schedules'].includes(resource)
        ? this.optional(this.api.all(company, 'establishments')) : of([]),
      positions: resource === 'departments' && this.can('departments:update')
        ? this.optional(this.api.all(company, 'job-positions', { status: 'ACTIVE' })) : of([]),
      categories: resource === 'job-functions' ? this.optional(this.api.all(company, 'professional-categories')) : of([]),
      functions: resource === 'job-positions' ? this.optional(this.api.all(company, 'job-functions')) : of([]),
      employees: this.canReadEmployees && ['departments', 'establishments', 'schedules'].includes(resource)
        ? this.optional(this.api.employees(company)) : of([]),
    }).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: result => {
        this.rows.set(result.rows);
        this.assignments.set(result.assignments);
        this.departments.set(result.departments);
        this.sites.set(result.sites);
        this.positions.set(result.positions);
        this.categories.set(result.categories);
        this.functions.set(result.functions);
        this.employees.set(result.employees);
        this.loading.set(false);
      },
      error: error => { this.loading.set(false); this.error.set(organizationErrorMessage(error)); },
    });
  }

  private optional<T>(request: Observable<T[]>) {
    return request.pipe(catchError(() => {
      this.referenceError.set($localize`:@@organization-some-related-records-could-not-be-loaded:Some related records could not be loaded.`);
      return of([]);
    }));
  }

  protected moveMonth(offset: number) {
    const start = new Date(this.month() + '-01T00:00:00Z');
    start.setUTCMonth(start.getUTCMonth() + offset);
    this.month.set(isoDate(start).slice(0, 7));
  }

  protected openForm(kind: FormKind) {
    this.error.set('');
    this.notice.set('');
    this.name = '';
    this.from = this.record.effectiveFrom && this.record.effectiveFrom > this.today ? this.record.effectiveFrom : this.today;
    this.to = '';
    this.employee = '';
    this.position = '';
    this.target = '';
    this.description = '';
    this.form.set(kind);
  }

  protected save() {
    const mode = this.form();
    if (!mode || this.busy()) return;
    this.error.set('');
    const company = this.context.company.id;
    const id = this.record.id;
    const code = crypto.randomUUID();
    const date = this.from;
    if (mode !== 'shift' && (!validPeriod(date, this.to) || date < this.today)) {
      this.error.set($localize`:@@organization-enter-a-valid-effective-period-starting-today-or-later:Enter a valid effective period starting today or later.`);
      return;
    }

    let request: Observable<OrganizationRecord>;
    switch (mode) {
      case 'department':
        if (!this.employee) return;
        request = this.api.create(company, childCollection('departments', id, 'employees'), {
          code, name: this.assignmentType === 'PRIMARY' ? 'Primary assignment' : 'Secondary assignment',
          employeeId: this.employee, effectiveFrom: date, effectiveTo: this.to || null,
          data: { assignmentType: this.assignmentType, jobPositionId: this.position || null },
        });
        break;
      case 'exception':
        if (!this.name.trim() || !this.description.trim()) return;
        if ((this.record.effectiveFrom && date < this.record.effectiveFrom) || (this.record.effectiveTo && date > this.record.effectiveTo)
            || this.rows().some(row => row.effectiveFrom === date && row.status === 'ACTIVE')) {
          this.error.set($localize`:@@organization-select-a-day-within-the-calendar-period-that-has-no-active-exception:Select a day within the calendar period that has no active exception.`);
          return;
        }
        request = this.api.create(company, childCollection('calendars', id, 'exceptions'), {
          code, name: this.name.trim(), effectiveFrom: date,
          data: { dayType: this.dayType, description: this.description.trim() },
        });
        break;
      case 'shift': {
        if (!this.name.trim() || !this.canAddShift) return;
        const shift: Shift = { weekday: this.weekday, startTime: this.start, endTime: this.end,
          crossesMidnight: this.overnight, breakMinutes: this.pause ?? -1 };
        const problem = shiftValidation(shift, this.shifts());
        if (problem) { this.error.set(problem); return; }
        request = this.api.create(company, childCollection('schedules', id, 'shifts'), { code, name: this.name.trim(), data: { ...shift } });
        break;
      }
      case 'scheduleAssignment':
        if (!this.target) return;
        if ((this.record.effectiveFrom && date < this.record.effectiveFrom)
            || (this.record.effectiveTo && (!this.to || this.to > this.record.effectiveTo))) {
          this.error.set($localize`:@@organization-the-assignment-must-stay-within-the-schedule-s-effective-period:The assignment must stay within the schedule’s effective period.`);
          return;
        }
        request = this.api.create(company, 'schedule-assignments', {
          code, name: 'Schedule assignment', relatedId: id, effectiveFrom: date, effectiveTo: this.to || null,
          data: { targetType: this.targetType, targetId: this.target },
        });
        break;
    }
    this.busy.set(true);
    request.pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: () => {
        this.busy.set(false);
        if (mode === 'shift') { this.changed.emit(); return; }
        this.form.set(null);
        this.notice.set($localize`:@@organization-record-added:Record added.`);
        if (mode === 'exception') this.month.set(date.slice(0, 7));
        this.load();
      },
      error: error => { this.busy.set(false); this.error.set(organizationErrorMessage(error)); },
    });
  }
}
