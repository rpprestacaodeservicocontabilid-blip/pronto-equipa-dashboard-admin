import { Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { employeeErrorMessage, employeeProfileOption } from './employee-display';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { employeeProfileSections, ProfileFields, ProfileSection, ProfileVersion } from '../domain/employee-administration';
import { EmployeesApi } from '../infrastructure/employees-api.service';

@Component({
  selector: 'app-employee-complementary', standalone: true,
  imports: [FormsModule, ComponentCardComponent],
  template: `
    <app-component-card [title]="schema.title">
      @if (error()) {
        <p role="alert" class="feedback mb-4">{{ error() }}</p>
        <button type="button" class="action mb-4" (click)="load()" [disabled]="busy()"><ng-container i18n="@@employees-reload-section">Reload section</ng-container></button>
      }
      @if (notice()) { <p role="status" class="notice mb-4">{{ notice() }}</p> }
      @if (busy()) { <p role="status" class="mb-2 text-sm text-gray-600 dark:text-gray-400"><ng-container i18n="@@employees-working">Working…</ng-container></p> }
      @if (version() !== null) {
        <form #sectionForm="ngForm" (ngSubmit)="sectionForm.valid && save()" class="space-y-4">
          @for (row of fields; track row; let rowIndex = $index) {
            <fieldset [disabled]="busy() || !editable" class="grid gap-4 rounded-lg border border-gray-200 p-4 dark:border-gray-800 sm:grid-cols-2 xl:grid-cols-3">
              @for (field of schema.fields; track field.key) {
                <label class="field">{{ field.label }}
                  @if (field.options) {
                    <select [name]="field.key + '-' + rowIndex" class="control" [required]="!!field.required" [(ngModel)]="row[field.key]">
                      <option value=""><ng-container i18n="@@employees-select">Select</ng-container></option>
                      @for (entry of field.options; track entry) { <option [value]="entry">{{ optionLabel(entry) }}</option> }
                    </select>
                  } @else {
                    <input [name]="field.key + '-' + rowIndex" class="control" [type]="field.type || 'text'" [email]="field.type === 'email'"
                      [maxlength]="field.max ?? 250" [required]="!!field.required" [(ngModel)]="row[field.key]" />
                  }
                </label>
              }
              @if (schema.multiple && editable) {
                <button type="button" class="action justify-self-start sm:col-span-2 xl:col-span-3" (click)="remove(rowIndex)"><ng-container i18n="@@employees-remove-entry">Remove entry</ng-container></button>
              }
            </fieldset>
          } @empty {
            <p class="text-sm text-gray-600 dark:text-gray-400"><ng-container i18n="@@employees-no-entries-recorded">No entries recorded.</ng-container></p>
          }
          @if (editable) {
            <div class="flex flex-wrap gap-2">
              @if (schema.multiple) {
                <button type="button" class="action" (click)="add()" [disabled]="busy() || fields.length >= 30"><ng-container i18n="@@employees-add-entry">Add entry</ng-container></button>
              }
              <button class="action action-primary" [disabled]="busy() || sectionForm.invalid"><ng-container i18n="@@employees-save-section">Save section</ng-container></button>
            </div>
          }
        </form>
      }
    </app-component-card>
  `,
})
export class EmployeeComplementaryComponent implements OnInit {
  @Input({ required: true }) company = 0;
  @Input({ required: true }) employee = '';
  @Input({ required: true }) section: ProfileSection = 'address';
  @Input() permissions: readonly string[] = [];
  private readonly api = inject(EmployeesApi);
  private readonly destroy = inject(DestroyRef);
  protected readonly version = signal<number | null>(null);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly busy = signal(false);
  protected readonly optionLabel = employeeProfileOption;
  protected fields: ProfileFields[] = [];
  protected get schema() { return employeeProfileSections[this.section]; }
  protected get editable() { return this.permissions.includes(this.schema.manage); }

  ngOnInit() { this.load(); }

  protected load() {
    if (this.busy()) return;
    this.error.set('');
    this.notice.set('');
    this.version.set(null);
    this.busy.set(true);
    this.api.profileSection(this.company, this.employee, this.section).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: data => this.apply(data),
      error: error => this.fail(error),
    });
  }
  protected add() { if (this.fields.length < 30) this.fields.push({}); }
  protected remove(index: number) { this.fields.splice(index, 1); }

  protected save() {
    const version = this.version();
    if (this.busy() || version === null || !this.editable) return;
    this.error.set('');
    this.notice.set('');
    const entries = this.fields.map(row => Object.fromEntries(this.schema.fields
      .map(field => [field.key, row[field.key]?.trim() ?? ''])
      .filter(([, value]) => !!value)));
    this.busy.set(true);
    this.api.saveProfileSection(this.company, this.employee, this.section, version,
      this.schema.multiple ? { entries } : entries[0]).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: data => { this.apply(data); this.notice.set($localize`:@@employees-profile-section-updated:Profile section updated.`); },
      error: error => this.fail(error),
    });
  }

  private apply(response: ProfileVersion) {
    const { content, version } = response;
    this.fields = this.schema.multiple ? (Array.isArray(content.entries) ? content.entries : []) : [content as ProfileFields];
    this.version.set(version);
    this.busy.set(false);
  }
  private fail(error: unknown) {
    this.error.set(employeeErrorMessage(error));
    this.busy.set(false);
  }
}
