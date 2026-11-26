import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, Input, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { employeeErrorMessage, employeeImportError } from './employee-display';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { Employee, ImportResult } from '../domain/employee.models';
import { csvColumns, emptyEmployee, normalizeEmployee, previewEmployeeRows, previewEmployees, registrationFields } from '../domain/employee-registration';
import { readEmployeeWorkbook } from '../domain/employee-workbook';
import { EmployeesApi } from '../infrastructure/employees-api.service';

@Component({
  selector: 'app-employee-registration', standalone: true,
  imports: [FormsModule, RouterLink, ComponentCardComponent],
  templateUrl: './employee-registration.component.html',
})
export class EmployeeRegistrationComponent {
  protected readonly importError = employeeImportError;
  protected readonly copy = {
    register: $localize`:@@employees-register-an-employee:Register an employee`,
    fileImport: $localize`:@@employees-employee-file-import:Employee file import`,
  };

  @Input({ required: true }) company = 0;
  @Input() canRead = false;
  @Input() mode: 'new' | 'imports' = 'new';
  private readonly api = inject(EmployeesApi);
  private readonly destroy = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  protected draft = emptyEmployee();
  protected readonly fields = registrationFields;
  protected readonly preview = signal<ReturnType<typeof previewEmployees> | null>(null);
  protected readonly created = signal<Employee | null>(null);
  protected readonly imported = signal<ImportResult | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected save() {
    if (this.busy()) return;
    this.error.set('');
    this.created.set(null);
    try {
      const employee = normalizeEmployee(this.draft);
      this.busy.set(true);
      this.api.create(this.company, employee).pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: result => { this.created.set(result); this.draft = emptyEmployee(); this.busy.set(false); },
        error: error => this.fail(error),
      });
    } catch (error) { this.fail(error); }
  }

  protected async chooseFile(input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = '';
    this.preview.set(null);
    this.imported.set(null);
    this.error.set('');
    if (!file || this.busy()) return;
    if (file.size > 2 * 1024 * 1024 || !/\.(?:csv|xlsx)$/i.test(file.name)) {
      this.error.set($localize`:@@employees-choose-a-csv-or-xlsx-file-up-to-2-mb:Choose a CSV or XLSX file up to 2 MB.`);
      return;
    }
    this.busy.set(true);
    try {
      this.preview.set(/\.xlsx$/i.test(file.name)
        ? previewEmployeeRows(await readEmployeeWorkbook(await file.arrayBuffer()))
        : previewEmployees(await file.text()));
    } catch (error) { this.fail(error); }
    finally { this.busy.set(false); }
  }

  protected submitImport() {
    const preview = this.preview();
    if (this.busy() || !preview?.employees.length || preview.errors.length) return;
    this.preview.set(null);
    this.error.set('');
    this.busy.set(true);
    this.api.import(this.company, preview.employees).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: result => { this.imported.set(result); this.busy.set(false); },
      error: error => {
        this.fail(error);
        this.error.update(message => message + " " + $localize`:@@employees-check-whether-any-records-were-created-before-resubmitting:Check whether any records were created before resubmitting.`);
      },
    });
  }

  protected template() {
    const url = URL.createObjectURL(new Blob([csvColumns.join(',') + '\r\n'], { type: 'text/csv;charset=utf-8' }));
    const link = this.document.createElement('a');
    link.href = url;
    link.download = 'employee-import-template.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private fail(error: unknown) {
    this.error.set(employeeErrorMessage(error));
    this.busy.set(false);
  }
}
