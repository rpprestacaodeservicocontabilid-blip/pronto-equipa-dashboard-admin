import { DatePipe } from '@angular/common';
import { Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiPage, CompanyWorkspace } from '../../../../core/api/company-workspace-api';
import { organizationErrorMessage } from '../organization-display';
import { ComponentCardComponent } from '../../../../shared/components/common/component-card/component-card.component';
import { OrganizationRecord, OrganizationStatus, Resource } from '../../domain/organization.models';
import { ORGANIZATION_RESOURCES, resourceGrant } from '../../domain/organization.resources';
import { isoDate } from '../../domain/organization-validation';
import { OrganizationApi } from '../../infrastructure/organization-api.service';
import { OrganizationRecordEditorComponent } from './organization-record-editor.component';
import { OrganizationRecordChildrenComponent } from './organization-record-children.component';
import { OrganizationHistoryComponent } from '../history/organization-history.component';

@Component({
  selector: 'app-organization-resource',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, ComponentCardComponent, OrganizationRecordEditorComponent,
    OrganizationRecordChildrenComponent, OrganizationHistoryComponent],
  templateUrl: './organization-resource.component.html',
})
export class OrganizationResourceComponent implements OnInit {
  protected versionLabel(code: string, version: number) {
    return $localize`:@@organization-code-version:${code}:CODE: · Version ${version}:VERSION:`;
  }

  protected confirmLabel(row: OrganizationRecord) {
    return row.status === 'ACTIVE'
      ? $localize`:@@organization-deactivate-named-record:Deactivate ${row.name}:NAME:?`
      : $localize`:@@organization-activate-named-record:Activate ${row.name}:NAME:?`;
  }

  protected readonly labels = {
    active: $localize`:@@organization-active:Active`,
    inactive: $localize`:@@organization-inactive:Inactive`,
    openEnded: $localize`:@@organization-open-ended:Open-ended`,
    deactivate: $localize`:@@organization-deactivate:Deactivate`,
    activate: $localize`:@@organization-activate:Activate`,
    selectSchedule: $localize`:@@organization-select-a-schedule-to-manage-shifts:Select a schedule to manage shifts`,
    shifts: $localize`:@@organization-shifts:Shifts`,
  };

  @Input({ required: true }) context!: CompanyWorkspace;
  @Input({ required: true }) resource!: Resource;
  @Input() id = '';
  @Input() shiftsOnly = false;
  private readonly api = inject(OrganizationApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy = inject(DestroyRef);
  protected readonly page = signal<ApiPage<OrganizationRecord> | null>(null);
  protected readonly record = signal<OrganizationRecord | null>(null);
  protected readonly loading = signal(false);
  protected readonly edit = signal(false);
  protected readonly confirm = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  private readonly managers = signal(new Map<string, string>());
  protected search = '';
  protected status: OrganizationStatus | '' = '';
  private appliedSearch = '';
  private appliedStatus: OrganizationStatus | '' = '';
  protected readonly today = isoDate(new Date());

  protected get config() { return ORGANIZATION_RESOURCES[this.resource]; }
  protected get section() { return this.shiftsOnly ? 'shifts' : this.resource; }
  protected get canHistory() { return this.context.permissions.includes('organization:history:read'); }

  ngOnInit() {
    if (this.id) this.loadRecord();
    else {
      if (this.route.snapshot.queryParamMap.get('status') === 'INACTIVE') this.status = 'INACTIVE';
      this.searchPage();
      if (this.resource === 'departments' && this.context.permissions.includes('employees.read')) {
        this.api.employees(this.context.company.id).pipe(takeUntilDestroyed(this.destroy)).subscribe({
          next: employees => this.managers.set(new Map(employees.map(employee => [employee.id, employee.firstName + ' ' + employee.lastName]))),
          error: () => this.managers.set(new Map()),
        });
      }
    }
  }

  protected can(action: 'create' | 'update' | 'deactivate') {
    return this.context.permissions.includes(resourceGrant(this.resource, action));
  }

  protected searchPage() {
    this.appliedSearch = this.search.trim();
    this.appliedStatus = this.status;
    this.loadPage(1);
  }

  protected loadPage(page: number) {
    this.loading.set(true);
    this.error.set('');
    this.api.page(this.context.company.id, this.resource, {
      ...(this.appliedSearch ? { search: this.appliedSearch } : {}),
      ...(this.appliedStatus ? { status: this.appliedStatus } : {}),
    }, page).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: result => { this.page.set(result); this.loading.set(false); },
      error: error => { this.error.set(organizationErrorMessage(error)); this.loading.set(false); },
    });
  }

  protected loadRecord() {
    this.loading.set(true);
    this.error.set('');
    this.api.get(this.context.company.id, this.resource, this.id).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: record => { this.record.set(record); this.loading.set(false); },
      error: error => { this.error.set(organizationErrorMessage(error)); this.loading.set(false); },
    });
  }

  protected saved(record: OrganizationRecord) {
    this.edit.set(false);
    if (!this.id) {
      void this.router.navigate(['/organization', this.context.company.id, this.section, record.id]);
      return;
    }
    this.record.set(record);
    this.notice.set($localize`:@@organization-changes-saved:Changes saved.`);
  }

  protected changeStatus(record: OrganizationRecord) {
    if (!this.confirm() || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    this.api.status(this.context.company.id, this.resource, record).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: updated => {
        this.record.set(updated);
        this.confirm.set(false);
        this.busy.set(false);
        this.notice.set(updated.status === 'ACTIVE' ? $localize`:@@organization-record-activated:Record activated.` : $localize`:@@organization-record-deactivated:Record deactivated.`);
      },
      error: error => {
        this.confirm.set(false);
        this.busy.set(false);
        this.error.set(organizationErrorMessage(error));
      },
    });
  }

  protected display(value: unknown, choices?: readonly { value: string; label: string }[]) {
    const choice = choices?.find(option => option.value === value);
    if (choice) return choice.label;
    if (Array.isArray(value)) return value.join(', ') || '—';
    return typeof value === 'string' || typeof value === 'number' ? String(value) || '—' : '—';
  }

  protected summary(row: OrganizationRecord) {
    if (this.resource === 'establishments') return [row.data['province'], row.data['municipality']].filter(Boolean).join(' · ');
    if (this.resource === 'schedules') {
      const choices = ORGANIZATION_RESOURCES.schedules.fields.find(field => field.key === 'scheduleType')?.choices;
      return this.display(row.data['scheduleType'], choices);
    }
    const manager = row.data['managerEmployeeId'];
    if (this.resource === 'departments' && typeof manager === 'string') return this.managers().get(manager) ?? $localize`:@@organization-manager-assigned:Manager assigned`;
    return '';
  }
}
