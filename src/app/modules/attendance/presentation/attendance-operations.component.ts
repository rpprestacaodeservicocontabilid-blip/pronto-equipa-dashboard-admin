import { DatePipe } from '@angular/common';
import { Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { defer, switchMap } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { CompanyWorkspace } from '../../../core/api/company-workspace-api';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { downloadCsv } from '../domain/attendance-format';
import { IMPORT_FIELDS, ImportMapping, ImportPreview, ImportSheet, defaultMapping, importBatchKey, previewImport, readCsv } from '../domain/attendance-import';
import { AuditEvent, Employee, ImportResult, label } from '../domain/attendance.models';
import { AttendanceApi, PolicyInput } from '../infrastructure/attendance-api.service';

@Component({
  selector: 'app-attendance-operations',
  standalone: true,
  imports: [FormsModule, DatePipe, RouterLink, ComponentCardComponent],
  templateUrl: './attendance-operations.component.html',
})
export class AttendanceOperationsComponent implements OnInit {
  @Input({ required: true }) context!: CompanyWorkspace;
  @Input({ required: true }) section!: string;
  @Input() auditResource = '';
  @Input() auditActionFilter = '';

  private readonly api = inject(AttendanceApi);
  private readonly destroy = inject(DestroyRef);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly importFields = IMPORT_FIELDS;
  protected readonly sheet = signal<ImportSheet | null>(null);
  protected readonly preview = signal<ImportPreview | null>(null);
  protected readonly imported = signal<ImportResult | null>(null);
  protected readonly employees = signal<Employee[]>([]);
  protected readonly label = label;
  protected mapping: ImportMapping = defaultMapping([]);
  protected purpose = '';
  protected auditAction = '';
  protected resourceId = '';
  protected readonly auditEvents = signal<AuditEvent[] | null>(null);
  protected readonly nextCursor = signal<number | null>(null);
  protected policy: { lateToleranceMinutes: number | null; earlyDepartureToleranceMinutes: number | null; separationOfDuties: boolean } = {
    lateToleranceMinutes: null, earlyDepartureToleranceMinutes: null, separationOfDuties: true,
  };
  private appliedPurpose = '';
  private auditFilter: { action?: string; resourceId?: string } = {};
  private throughSequence?: number;
  private fileVersion = 0;

  protected get company() { return this.context.company.id; }

  ngOnInit() {
    this.resourceId = this.auditResource;
    this.auditAction = this.auditActionFilter;
    if (this.section === 'imports' && this.context.permissions.includes('employees.read')) {
      this.api.employees(this.company).pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: employees => this.employees.set(employees), error: () => {},
      });
    }
  }

  protected async openFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    const version = ++this.fileVersion;
    this.error.set('');
    this.sheet.set(null);
    this.preview.set(null);
    this.imported.set(null);
    if (!file) return;
    try {
      if (!file.name.toLowerCase().endsWith('.csv')) throw new Error('Select a CSV file.');
      if (file.size > 10_000_000) throw new Error('The CSV file must be 10 MB or smaller.');
      const content = await file.text();
      if (version !== this.fileVersion || this.destroy.destroyed) return;
      const sheet = readCsv(content);
      this.mapping = defaultMapping(sheet.columns);
      this.sheet.set(sheet);
    } catch (error) {
      if (version === this.fileVersion && !this.destroy.destroyed) this.error.set(apiErrorMessage(error));
    }
  }

  protected validateCsv() {
    const sheet = this.sheet();
    if (!sheet || this.busy()) return;
    this.error.set('');
    this.preview.set(null);
    this.imported.set(null);
    try {
      this.preview.set(previewImport(sheet, this.mapping, this.employees()));
    } catch (error) {
      this.error.set(apiErrorMessage(error));
    }
  }

  protected importRecords() {
    const preview = this.preview();
    if (!preview?.rows.length || preview.errors.length || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    defer(() => importBatchKey(preview.rows)).pipe(
      switchMap(key => this.api.import(this.company, key, preview.rows)),
      takeUntilDestroyed(this.destroy),
    ).subscribe({
      next: result => { this.imported.set(result); this.busy.set(false); },
      error: error => this.fail(error),
    });
  }

  protected exportImport(result: ImportResult) {
    downloadCsv('attendance-import-' + result.batch.id + '.csv', [
      ['Batch ID', 'Batch status', 'Submitted', 'Imported', 'Errors'],
      [result.batch.id, result.batch.status, result.batch.data.totalRows, result.batch.data.importedRows, result.batch.data.errorRows],
      [], ['Batch row', 'Status', 'Punch ID', 'Error'],
      ...result.items.map(item => [item.data.row, item.status, item.data.punchId, item.data.error]),
    ]);
  }

  protected savePolicy(form: NgForm) {
    if (form.invalid || this.busy()) return;
    const { lateToleranceMinutes, earlyDepartureToleranceMinutes } = this.policy;
    if (lateToleranceMinutes == null || earlyDepartureToleranceMinutes == null ||
      ![lateToleranceMinutes, earlyDepartureToleranceMinutes].every(value => Number.isInteger(value) && value >= 0 && value <= 1440)) {
      this.error.set('Enter whole-minute tolerances between 0 and 1440.');
      return;
    }
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    const policy: PolicyInput = { ...this.policy, lateToleranceMinutes, earlyDepartureToleranceMinutes };
    this.api.savePolicy(this.company, policy).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: result => { this.notice.set('Policy version ' + result.version + ' saved.'); this.busy.set(false); },
      error: error => this.fail(error),
    });
  }

  protected loadAudit(reset: boolean) {
    if (this.busy()) return;
    if (reset) {
      this.appliedPurpose = this.purpose.trim();
      this.auditFilter = {
        ...(this.auditAction.trim() ? { action: this.auditAction.trim() } : {}),
        ...(this.resourceId.trim() ? { resourceId: this.resourceId.trim() } : {}),
      };
      this.auditEvents.set(null);
      this.nextCursor.set(null);
      this.throughSequence = undefined;
    }
    if (!this.appliedPurpose) return;
    this.busy.set(true);
    this.error.set('');
    this.api.audit(this.company, this.appliedPurpose, this.auditFilter, this.nextCursor() ?? undefined, this.throughSequence)
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: result => {
          this.auditEvents.update(events => [...(events ?? []), ...result.data]);
          this.nextCursor.set(result.nextCursor);
          this.throughSequence = result.throughSequence;
          this.busy.set(false);
        },
        error: error => this.fail(error),
      });
  }

  private fail(error: unknown) {
    this.error.set(apiErrorMessage(error));
    this.busy.set(false);
  }
}
