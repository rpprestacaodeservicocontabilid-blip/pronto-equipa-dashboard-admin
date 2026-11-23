import { Component, DestroyRef, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Observable, catchError, from, map, mergeMap, of, switchMap, toArray } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { CompanyWorkspace } from '../../../core/api/company-workspace-api';
import { TODAY, UUID, effective, human, validDate } from '../domain/salary-format';
import { CatalogRecord, ComponentDetail } from '../domain/salary.models';
import { can } from '../domain/salary-sections';
import { SalaryApi } from '../infrastructure/salary-api.service';
import { Choice, Field } from './salary-form';

@Component({
  selector: 'app-salary-field',
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (field.kind === 'check') {
      <label class="flex min-h-10 items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input type="checkbox" [ngModel]="value === true" [ngModelOptions]="{standalone: true}" [disabled]="disabled"
          (ngModelChange)="update.emit($event)" /> {{ field.label }}
      </label>
    } @else {
      <label class="field">{{ field.label }}{{ field.required ? '' : ' (optional)' }}
        @switch (field.kind) {
          @case ('select') {
            <select class="control" [ngModel]="value" [ngModelOptions]="{standalone: true}" [disabled]="disabled" (ngModelChange)="update.emit($event)">
              @for (choice of field.choices; track choice.value) { <option [value]="choice.value">{{ choice.label }}</option> }
            </select>
          }
          @case ('textarea') {
            <textarea class="control" rows="4" [maxlength]="field.max ?? 12000" [ngModel]="value" [ngModelOptions]="{standalone: true}"
              [disabled]="disabled" (ngModelChange)="update.emit($event)"></textarea>
          }
          @default {
            <input class="control" [type]="field.kind === 'date' ? 'date' : 'text'" [attr.inputmode]="field.kind === 'amount' ? 'decimal' : null"
              [attr.maxlength]="field.max ?? null" [ngModel]="value" [ngModelOptions]="{standalone: true}" [disabled]="disabled"
              (ngModelChange)="update.emit($event)" />
          }
        }
      </label>
      @if (lookupAllowed) {
        <div class="mt-2">
          @if (!opened()) {
            <button class="action text-xs" type="button" [disabled]="disabled" (click)="opened.set(true)">Find {{ field.reference }} record</button>
          } @else {
            <div class="space-y-2 rounded-lg border border-gray-200 p-3 dark:border-gray-800">
              @if (field.reference !== 'contract') {
                <label class="field">Search {{ field.reference }}
                  <input class="control" type="search" [disabled]="disabled || loading()" maxlength="100" [(ngModel)]="search"
                    [ngModelOptions]="{standalone: true}" placeholder="Name or code" />
                </label>
              }
              <div class="flex gap-2">
                <button type="button" class="action" [disabled]="disabled || loading()" (click)="lookup()">{{ loading() ? 'Searching…' : 'Search' }}</button>
                <button type="button" class="action" [disabled]="disabled || loading()" (click)="opened.set(false); options.set(null)">Close lookup</button>
              </div>
              @if (error()) { <p class="feedback" role="alert">{{ error() }}</p> }
              @if (options(); as choices) {
                <ul class="max-h-40 space-y-2 overflow-auto">
                  @for (choice of choices; track choice.value) {
                    <li><button class="action w-full justify-start text-start" type="button" [disabled]="disabled" (click)="select(choice)">
                      {{ choice.label }}
                    </button></li>
                  } @empty { <li class="text-sm text-gray-600 dark:text-gray-400">No matching records.</li> }
                </ul>
              }
            </div>
          }
        </div>
      }
    }
  `,
})
export class SalaryFieldComponent {
  @Input({ required: true }) field!: Field;
  @Input({ required: true }) context!: CompanyWorkspace;
  @Input() value: string | boolean = '';
  @Input() disabled = false;
  @Input() employeeId = '';
  @Input() date = '';
  @Output() readonly update = new EventEmitter<string | boolean>();
  private readonly api = inject(SalaryApi);
  private readonly destroy = inject(DestroyRef);
  protected readonly error = signal('');
  protected readonly opened = signal(false);
  protected readonly loading = signal(false);
  protected readonly options = signal<Choice[] | null>(null);
  protected search = '';

  protected get lookupAllowed() {
    const permissions = this.context.permissions;
    if (this.field.reference === 'employee') return permissions.includes('employees.read');
    if (this.field.reference === 'contract') return permissions.includes('contracts.read') && UUID.test(this.employeeId);
    return !!this.field.reference && can(permissions, 'read');
  }

  protected lookup() {
    if (!this.lookupAllowed || this.loading()) return;
    this.error.set('');
    this.options.set(null);
    this.loading.set(true);
    this.searchOptions().pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: choices => { this.options.set(choices); this.loading.set(false); },
      error: error => { this.error.set(apiErrorMessage(error)); this.loading.set(false); },
    });
  }

  protected select(choice: Choice) {
    this.update.emit(choice.value);
    this.opened.set(false);
    this.options.set(null);
  }

  private searchOptions(): Observable<Choice[]> {
    const company = this.context.company.id;
    const date = validDate(this.date) ? this.date : TODAY();
    if (this.field.reference === 'employee') return this.api.employees(company, this.search.trim()).pipe(map(records => records.map(item => ({
      value: item.id, label: item.firstName + ' ' + item.lastName + ' · ' + item.employeeNumber,
    }))));
    if (this.field.reference === 'contract') return this.api.activeContracts(company, this.employeeId).pipe(map(records => records
      .filter(item => item.startDate <= date && (!item.endDate || item.endDate >= date))
      .map(item => ({ value: item.id, label: item.contractNumber + ' · ' + item.startDate + ' · ' + item.currency }))));

    const resource = this.field.reference === 'component' ? 'components' : 'structures';
    const search = this.search.trim().toLowerCase();
    return this.api.all(page => this.api.page<CatalogRecord>(company, resource, { status: 'ACTIVE' }, page, 100)).pipe(
      map(records => records.filter(item => (item.code + ' ' + item.name).toLowerCase().includes(search)).slice(0, 25)),
      switchMap(records => from(records).pipe(
        mergeMap(record => this.api.catalog(company, resource, record.id).pipe(
          map(detail => detail.versions.filter(version =>
            ['PUBLISHED', 'SUPERSEDED', ...(resource === 'structures' ? ['SCHEDULED'] : [])].includes(version.status) &&
            effective(version, date)).map(version => ({
              value: version.id,
              label: detail.code + ' · ' + detail.name + ' · v' + version.version +
                (resource === 'components' ? ' · ' + human((version as ComponentDetail['versions'][number]).calculationMethod) : ''),
            }))),
          catchError(() => of([])),
        ), 4),
        toArray(), map(results => results.flat().sort((a, b) => a.label.localeCompare(b.label))),
      )),
    );
  }
}
