import { DatePipe, formatDate, formatPercent } from '@angular/common';
import { Component, DestroyRef, Input, LOCALE_ID, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { CompanyWorkspace } from '../../../../core/api/company-workspace-api';
import { organizationErrorMessage, organizationOptionLabel } from '../organization-display';
import { ComponentCardComponent } from '../../../../shared/components/common/component-card/component-card.component';
import { OrganizationHistory, OrganizationRecord, Resource } from '../../domain/organization.models';
import { ORGANIZATION_RESOURCES, WEEKDAYS } from '../../domain/organization.resources';
import { OrganizationApi } from '../../infrastructure/organization-api.service';

const HISTORY_FIELDS = new Map<string, string>([
  ['code', $localize`:@@organization-code:Code`],
  ['name', $localize`:@@organization-name:Name`],
  ['status', $localize`:@@organization-status:Status`],
  ['parentId', $localize`:@@organization-parent-id:Parent ID`],
  ['effectiveFrom', $localize`:@@organization-effective-from:Effective from`],
  ['effectiveTo', $localize`:@@organization-effective-to:Effective to`],
  ['relatedId', $localize`:@@organization-related-record:Related record`],
  ['employeeId', $localize`:@@organization-employee:Employee`],
  ['assignmentType', $localize`:@@organization-assignment-type:Assignment type`],
  ['jobPositionId', $localize`:@@organization-job-position:Job position`],
  ['dayType', $localize`:@@organization-day-type:Day type`],
  ['description', $localize`:@@organization-description:Description`],
  ['targetType', $localize`:@@organization-assignment-target:Assignment target`],
  ['targetId', $localize`:@@organization-target-id:Target ID`],
  ['percentage', $localize`:@@organization-percentage:Percentage`],
  ['shifts', $localize`:@@organization-shift-schedule:Shift schedule`],
]);
const OPTION_FIELDS = new Set(['status', 'assignmentType', 'dayType', 'targetType']);
const DATE_FIELDS = new Set(['effectiveFrom', 'effectiveTo', 'openedAt', 'closedAt']);

@Component({
  selector: 'app-organization-history',
  standalone: true,
  imports: [DatePipe, FormsModule, ComponentCardComponent],
  templateUrl: './organization-history.component.html',
})
export class OrganizationHistoryComponent implements OnInit {
  protected readonly labels = {
    system: $localize`:@@organization-system:System`,
  };

  @Input({ required: true }) context!: CompanyWorkspace;
  @Input() resource: Resource = 'departments';
  @Input() recordId = '';
  private readonly api = inject(OrganizationApi);
  private readonly locale = inject(LOCALE_ID);
  private readonly destroy = inject(DestroyRef);
  protected readonly resources = Object.entries(ORGANIZATION_RESOURCES) as [Resource, { label: string }][];
  protected readonly choices = signal<OrganizationRecord[]>([]);
  protected readonly entries = signal<OrganizationHistory[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected selectedResource: Resource = 'departments';
  protected selectedRecord = '';

  ngOnInit() {
    if (!this.allowed) return;
    this.selectedResource = this.resource;
    this.selectedRecord = this.recordId;
    if (this.recordId) this.load();
    else this.loadChoices();
  }

  protected get allowed() { return this.context.permissions.includes('organization:history:read'); }

  protected loadChoices() {
    this.selectedRecord = '';
    this.entries.set([]);
    this.choices.set([]);
    this.error.set('');
    this.loading.set(true);
    this.api.all(this.context.company.id, this.selectedResource).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: choices => { this.choices.set(choices); this.loading.set(false); },
      error: error => { this.error.set(organizationErrorMessage(error)); this.loading.set(false); },
    });
  }

  protected load() {
    if (!this.selectedRecord) { this.entries.set([]); return; }
    this.error.set('');
    this.loading.set(true);
    this.api.history(this.context.company.id, this.selectedResource, this.selectedRecord)
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: records => { this.entries.set([...records].reverse()); this.loading.set(false); },
        error: error => { this.error.set(organizationErrorMessage(error)); this.loading.set(false); },
      });
  }

  protected accountLabel(id: number) {
    return $localize`:@@organization-account-number:Account #${id}:NUMBER:`;
  }

  protected historyType(type: string) {
    switch (type) {
      case 'CREATED': return $localize`:@@organization-created:Created`;
      case 'UPDATED': return $localize`:@@organization-updated:Updated`;
      case 'ACTIVE': return $localize`:@@organization-activated:Activated`;
      case 'INACTIVE': return $localize`:@@organization-deactivated:Deactivated`;
      case 'MOVED': return $localize`:@@organization-moved:Moved`;
      default: return type;
    }
  }

  protected comparison(entry: OrganizationHistory) {
    const { previousData, newData } = entry;
    const bare = (record: OrganizationRecord | null): Record<string, unknown> => record ? {
      ...record.data, code: record.code, name: record.name, status: record.status, parentId: record.parentId,
      effectiveFrom: record.effectiveFrom, effectiveTo: record.effectiveTo, relatedId: record.relatedId,
      employeeId: record.employeeId,
    } : {};
    const before = bare(previousData);
    const after = bare(newData);
    const fields = ORGANIZATION_RESOURCES[this.selectedResource].fields;
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap(key => {
      if (JSON.stringify(before[key]) === JSON.stringify(after[key])) return [];
      const field = fields.find(entry => entry.key === key);
      const label = HISTORY_FIELDS.get(key) ?? field?.label ?? key;
      const display = (value: unknown) => field?.choices?.find(choice => choice.value === value)?.label
        ?? this.displayValue(key, value);
      return [{ key, label, before: display(before[key]), after: display(after[key]) }];
    });
  }

  private displayValue(key: string, value: unknown): string {
    if (OPTION_FIELDS.has(key)) return organizationOptionLabel(value);
    if (DATE_FIELDS.has(key) && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const date = new Date(value + 'T00:00:00Z');
      if (Number.isFinite(date.getTime())) return formatDate(date, 'mediumDate', this.locale, 'UTC');
    }
    if (key === 'percentage' && (typeof value === 'number' || typeof value === 'string') && value !== '') {
      const percentage = Number(value);
      if (Number.isFinite(percentage)) return formatPercent(percentage / 100, this.locale, '1.0-2');
    }
    if (key === 'workingWeekdays' && Array.isArray(value)) {
      const weekdays = value.map(day => typeof day === 'number' ? WEEKDAYS[day] : undefined);
      if (weekdays.every((day): day is string => day !== undefined)) {
        return new Intl.ListFormat(this.locale).format(weekdays) || '—';
      }
    }
    if (key === 'shifts' && Array.isArray(value)) {
      const shifts = value.map(raw => {
        if (!raw || typeof raw !== 'object') return undefined;
        const { weekday, startTime, endTime, breakMinutes, crossesMidnight } = raw as Record<string, unknown>;
        const day = typeof weekday === 'number' ? WEEKDAYS[weekday] : undefined;
        if (!day || typeof startTime !== 'string' || typeof endTime !== 'string' || typeof breakMinutes !== 'number') {
          return undefined;
        }
        const end = crossesMidnight === true
          ? $localize`:@@organization-shift-next-day:${endTime}:TIME: (next day)`
          : endTime;
        const pause = $localize`:@@organization-shift-duration-in-minutes:${breakMinutes}:MINUTES: min`;
        return $localize`:@@organization-shift-detail:${day}:DAY: · ${startTime}:START:–${end}:END: · break ${pause}:BREAK:`;
      });
      if (shifts.every((shift): shift is string => shift !== undefined)) {
        return shifts.join('\n') || '—';
      }
    }
    return format(value);
  }
}

function format(value: unknown): string {
  if (value == null || value === '') return '—';
  return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
}
