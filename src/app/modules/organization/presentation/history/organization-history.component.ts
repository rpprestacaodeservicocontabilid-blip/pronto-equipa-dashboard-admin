import { DatePipe } from '@angular/common';
import { Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { CompanyWorkspace } from '../../../../core/api/company-workspace-api';
import { apiErrorMessage } from '../../../../core/api/api-error';
import { ComponentCardComponent } from '../../../../shared/components/common/component-card/component-card.component';
import { OrganizationHistory, OrganizationRecord, Resource } from '../../domain/organization.models';
import { ORGANIZATION_RESOURCES } from '../../domain/organization.resources';
import { OrganizationApi } from '../../infrastructure/organization-api.service';

@Component({
  selector: 'app-organization-history',
  standalone: true,
  imports: [DatePipe, FormsModule, ComponentCardComponent],
  templateUrl: './organization-history.component.html',
})
export class OrganizationHistoryComponent implements OnInit {
  @Input({ required: true }) context!: CompanyWorkspace;
  @Input() resource: Resource = 'departments';
  @Input() recordId = '';
  private readonly api = inject(OrganizationApi);
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
      error: error => { this.error.set(apiErrorMessage(error)); this.loading.set(false); },
    });
  }

  protected load() {
    if (!this.selectedRecord) { this.entries.set([]); return; }
    this.error.set('');
    this.loading.set(true);
    this.api.history(this.context.company.id, this.selectedResource, this.selectedRecord)
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: records => { this.entries.set([...records].reverse()); this.loading.set(false); },
        error: error => { this.error.set(apiErrorMessage(error)); this.loading.set(false); },
      });
  }

  protected comparison(entry: OrganizationHistory) {
    const { previousData, newData } = entry;
    const bare = (record: OrganizationRecord | null): Record<string, unknown> => record ? {
      Code: record.code, Name: record.name, Status: record.status, 'Parent ID': record.parentId,
      'Effective from': record.effectiveFrom, 'Effective to': record.effectiveTo, ...record.data,
    } : {};
    const before = bare(previousData);
    const after = bare(newData);
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap(key => {
      if (JSON.stringify(before[key]) === JSON.stringify(after[key])) return [];
      return [{ key, before: format(before[key]), after: format(after[key]) }];
    });
  }
}

function format(value: unknown): string {
  if (value == null || value === '') return '—';
  return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
}
