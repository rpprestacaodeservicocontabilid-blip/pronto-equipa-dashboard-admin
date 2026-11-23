import { Component, computed, inject, Input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { payrollQuery } from '../../payroll/presentation/payroll-ui';
import { categorySummary, effectiveState, legalLabel, legalScope, todayInAngola } from '../domain/legal-format';
import { LegalSection } from '../domain/legal-navigation';
import { LEGAL_STATUSES, LegalVersion } from '../domain/legal.models';
import { LegalRulesApi } from '../infrastructure/legal-rules-api.service';

@Component({
  selector: 'app-legal-catalog', standalone: true,
  imports: [FormsModule, RouterLink, ComponentCardComponent], templateUrl: './legal-catalog.component.html',
})
export class LegalCatalogComponent {
  @Input({ required: true }) section!: LegalSection;
  private readonly api = inject(LegalRulesApi);
  private readonly auth = inject(AuthService);
  private readonly refresh = signal(0);
  protected readonly today = todayInAngola();
  protected readonly search = signal('');
  protected readonly status = signal('');
  protected readonly page = signal(1);
  protected readonly pageSize = 20;
  protected readonly statuses = LEGAL_STATUSES;
  protected readonly label = legalLabel;
  protected readonly scope = legalScope;
  protected readonly rows = payrollQuery(this.refresh, () => this.api.versions());
  protected readonly sourceTotal = payrollQuery(this.refresh, () =>
    this.section?.path === 'overview' ? this.api.sourceCount() : of(0));
  protected readonly canCreate = computed(() => this.auth.claims()?.permissions.includes('legal-rules:create'));
  protected readonly counts = computed(() => {
    const response = this.rows();
    const rows = response && 'data' in response ? response.data : [];
    return {
      published: rows.filter(row => row.status === 'PUBLISHED').length,
      active: rows.filter(row => effectiveState(row, this.today) === 'In force').length,
      inReview: rows.filter(row => row.status === 'IN_REVIEW').length,
      future: rows.filter(row => effectiveState(row, this.today) === 'Scheduled').length,
      awaiting: rows.filter(row => row.status === 'APPROVED').length,
      expired: rows.filter(row => effectiveState(row, this.today) === 'Expired').length,
    };
  });
  protected readonly filtered = computed(() => {
    const response = this.rows();
    if (!response || !('data' in response)) return [];
    const query = this.search().trim().toLowerCase();
    const path = this.section.path;
    const rows = response.data.filter(record =>
      (path !== 'approvals' || ['IN_REVIEW', 'APPROVED', 'REJECTED'].includes(record.status)) &&
      (path !== 'publications' || ['APPROVED', 'PUBLISHED', 'RETIRED'].includes(record.status)) &&
      (!this.status() || effectiveState(record, this.today) === this.status() || record.status === this.status()) &&
      [record.ruleSetId, record.version, record.sourceReference, legalScope(record)].some(value => value.toLowerCase().includes(query)));
    return path === 'versions' || path === 'publications'
      ? rows.sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom)) : rows;
  });
  protected readonly visible = computed(() => this.filtered().slice((this.page() - 1) * this.pageSize, this.page() * this.pageSize));

  protected reload() { this.refresh.update(value => value + 1); }
  protected changePage(delta: number) { this.page.update(value => value + delta); }
  protected state(record: LegalVersion) { return effectiveState(record, this.today); }
  protected details(record: LegalVersion) {
    return this.section.view === 'category' ? categorySummary(record, this.section.path) : record.sourceReference;
  }
}
