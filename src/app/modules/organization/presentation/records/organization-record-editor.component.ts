import { Component, DestroyRef, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { catchError, forkJoin, map, of } from 'rxjs';
import { CompanyWorkspace } from '../../../../core/api/company-workspace-api';
import { organizationErrorMessage } from '../organization-display';
import { OrganizationInput, OrganizationRecord, Resource } from '../../domain/organization.models';
import { Field, MONDAY_FIRST, ORGANIZATION_RESOURCES, WEEKDAYS } from '../../domain/organization.resources';
import { isoDate, validPeriod } from '../../domain/organization-validation';
import { OrganizationApi } from '../../infrastructure/organization-api.service';

type Choice = { value: string; label: string };
type Source = Resource | 'employees';

@Component({
  selector: 'app-organization-record-editor',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './organization-record-editor.component.html',
})
export class OrganizationRecordEditorComponent implements OnInit {
  protected editLabel(name: string) {
    return $localize`:@@organization-edit-named-record:Edit ${name}:NAME:`;
  }

  protected readonly labels = {
    newRecord: $localize`:@@organization-new-record:New record`,
    keepAssociation: $localize`:@@organization-keep-current-association:Keep current association`,
    selectRecord: $localize`:@@organization-select-a-record:Select a record`,
    none: $localize`:@@organization-none:None`,
    saving: $localize`:@@organization-saving:Saving…`,
    saveRecord: $localize`:@@organization-save-record:Save record`,
  };

  @Input({ required: true }) context!: CompanyWorkspace;
  @Input({ required: true }) resource!: Resource;
  @Input() record: OrganizationRecord | null = null;
  @Output() saved = new EventEmitter<OrganizationRecord>();
  @Output() dismissed = new EventEmitter<void>();
  private readonly api = inject(OrganizationApi);
  private readonly destroy = inject(DestroyRef);
  protected code = '';
  protected name = '';
  protected effectiveFrom = '';
  protected effectiveTo = '';
  protected days = new Set([1, 2, 3, 4, 5]);
  protected readonly weekdays = WEEKDAYS;
  protected readonly order = MONDAY_FIRST;
  protected readonly busy = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly referenceError = signal('');
  protected readonly references = signal<Partial<Record<Source, Choice[]>>>({});
  protected readonly fields: Field[] = [];
  protected readonly values: Record<string, string> = {};
  private readonly original: Record<string, string> = {};

  protected get config() { return ORGANIZATION_RESOURCES[this.resource]; }

  ngOnInit() {
    this.fields.push(...this.config.fields);
    if (!this.record && this.resource === 'departments' && this.context.permissions.includes('organization:hierarchy:manage')) {
      this.fields.unshift({ key: 'parentId', label: $localize`:@@organization-parent-department:Parent department`, kind: 'reference', source: 'departments', topLevel: true });
    }
    const row = this.record;
    this.code = row?.code ?? '';
    this.name = row?.name ?? '';
    this.effectiveFrom = row?.effectiveFrom ?? (this.config.dated ? isoDate(new Date()) : '');
    this.effectiveTo = row?.effectiveTo ?? '';
    for (const field of this.fields) {
      const value = field.topLevel
        ? (field.key === 'parentId' ? row?.parentId : row?.relatedId)
        : row?.data[field.key];
      if (field.kind === 'weekdays') {
        if (Array.isArray(value)) this.days = new Set(value.filter(day => typeof day === 'number'));
      } else {
        this.values[field.key] = field.kind === 'lines' && Array.isArray(value) ? value.join('\n')
          : typeof value === 'string' || typeof value === 'number' ? String(value) : '';
        this.original[field.key] = this.values[field.key];
      }
    }
    this.loadReferences();
  }

  protected choices(field: Field) {
    if (field.choices) return field.choices;
    const choices = field.source ? this.references()[field.source] ?? [] : [];
    return field.key === 'parentId' ? choices.filter(entry => entry.value !== this.record?.id && !this.isDescendant(entry.value)) : choices;
  }

  protected currentChoiceMissing(field: Field) {
    const value = this.values[field.key];
    return Boolean(value && !this.choices(field).some(choice => choice.value === value));
  }

  private parentById = new Map<string, string | null | undefined>();
  private isDescendant(id: string) {
    if (!this.record) return false;
    const visited = new Set<string>();
    let parent = this.parentById.get(id);
    while (parent && !visited.has(parent)) {
      if (parent === this.record.id) return true;
      visited.add(parent);
      parent = this.parentById.get(parent);
    }
    return false;
  }

  protected loadReferences() {
    const sources = [...new Set(this.fields.flatMap(field => field.source ? [field.source] : []))];
    if (!sources.length) return;
    this.loading.set(true);
    this.referenceError.set('');
    const companyId = this.context.company.id;
    forkJoin(sources.map(source => {
      const items = source === 'employees'
        ? (this.context.permissions.includes('employees.read')
          ? this.api.employees(companyId).pipe(map(employees => employees.map(employee => ({
            value: employee.id, label: employee.firstName + ' ' + employee.lastName + ' · ' + employee.employeeNumber,
          })))) : of([]))
        : this.api.all(companyId, source, { status: 'ACTIVE' }).pipe(map(records => {
          if (source === this.resource) this.parentById = new Map(records.map(record => [record.id, record.parentId]));
          return records.map(record => ({ value: record.id, label: record.name + ' · ' + record.code }));
        }));
      return items.pipe(
        map(choices => [source, choices] as const),
        catchError(() => {
          this.referenceError.set($localize`:@@organization-some-reference-lists-could-not-be-loaded-try-again-before-changing-a-reference:Some reference lists could not be loaded. Try again before changing a reference.`);
          return of([source, []] as const);
        }),
      );
    })).pipe(takeUntilDestroyed(this.destroy)).subscribe(values => {
      this.references.set(Object.fromEntries(values));
      this.loading.set(false);
    });
  }

  protected toggleDay(day: number, checked: boolean) {
    if (checked) this.days.add(day);
    else this.days.delete(day);
  }

  protected save() {
    if (this.busy() || this.loading()) return;
    this.error.set('');
    let input: OrganizationInput;
    try { input = this.build(); }
    catch (error) { this.error.set(organizationErrorMessage(error)); return; }
    this.busy.set(true);
    const company = this.context.company.id;
    const request = this.record ? this.api.update(company, this.resource, this.record, input) : this.api.create(company, this.resource, input);
    request.pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: saved => { this.busy.set(false); this.saved.emit(saved); },
      error: error => { this.busy.set(false); this.error.set(organizationErrorMessage(error)); },
    });
  }

  private build(): OrganizationInput {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,49}$/.test(this.code.trim()) || !this.name.trim()) {
      throw new Error($localize`:@@organization-enter-a-valid-code-and-name:Enter a valid code and name.`);
    }
    if (this.config.dated && !validPeriod(this.effectiveFrom, this.effectiveTo)) {
      throw new Error($localize`:@@organization-enter-a-start-date-and-an-end-date-on-or-after-it:Enter a start date and an end date on or after it.`);
    }
    if (this.resource === 'establishments' && this.values['openedAt'] && this.values['closedAt'] &&
        this.values['closedAt'] < this.values['openedAt']) throw new Error($localize`:@@organization-the-closing-date-must-be-on-or-after-the-opening-date:The closing date must be on or after the opening date.`);
    const input: OrganizationInput = {
      code: this.code.trim(), name: this.name.trim(), data: { ...this.record?.data },
      ...(this.config.dated ? { effectiveFrom: this.effectiveFrom, effectiveTo: this.effectiveTo || null } : {}),
    };
    for (const field of this.fields) {
      if (field.kind === 'weekdays') {
        if (!this.days.size) throw new Error($localize`:@@organization-select-at-least-one-working-day:Select at least one working day.`);
        input.data[field.key] = [...this.days].sort();
        continue;
      }
      const value = this.values[field.key].trim();
      if (field.topLevel && this.record && this.original[field.key] === value) continue;
      if (field.required && !value) {
        throw new Error($localize`:@@organization-complete-field:Complete the “${field.label}:FIELD:” field.`);
      }
      if (field.topLevel) {
        if (field.key === 'parentId') input.parentId = value || null;
        else input.relatedId = value && value !== 'clear' ? value : null;
      } else if (field.kind === 'lines') {
        const lines = value.split('\n').map(line => line.trim()).filter(Boolean);
        if (lines.length > 50 || lines.some(line => line.length > 250)) throw new Error($localize`:@@organization-use-up-to-50-requirements-of-up-to-250-characters-each:Use up to 50 requirements of up to 250 characters each.`);
        input.data[field.key] = lines;
      } else if (field.kind === 'integer') {
        const number = Number(value);
        const min = field.key === 'weeklyMinutes' ? 1 : 0;
        if (value && (!Number.isInteger(number) || number < min || number > (field.max ?? Infinity))) {
          throw new Error($localize`:@@organization-valid-integer:Enter a valid integer for “${field.label}:FIELD:”.`);
        }
        if (value) input.data[field.key] = number;
        else delete input.data[field.key];
      } else if (field.kind === 'reference' || field.kind === 'date' || field.kind === 'email') {
        input.data[field.key] = value || null;
      } else {
        input.data[field.key] = value;
      }
    }
    return input;
  }
}
