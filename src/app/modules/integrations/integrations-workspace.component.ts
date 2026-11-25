import { DatePipe } from '@angular/common';
import { Component, ViewEncapsulation, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/api/api-error';
import { AuthService } from '../../core/auth/auth.service';
import { ComponentCardComponent } from '../../shared/components/common/component-card/component-card.component';
import { PageBreadcrumbComponent } from '../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { IntegrationsApi, IntegrationInventory, ProviderState } from './integrations-api';
import { INTEGRATION_SECTIONS, IntegrationSection, IntegrationSource } from './integrations.navigation';

const labels: Record<ProviderState, string> = {
  REGISTERED: 'Registered adapter', CONFIGURED: 'Configuration present', NOT_CONFIGURED: 'Configuration missing',
  ACTIVE: 'Active', DISABLED: 'Disabled', UNKNOWN: 'Unknown',
};

@Component({
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, ComponentCardComponent, PageBreadcrumbComponent],
  templateUrl: './integrations-workspace.component.html',
  styleUrl: '../../shared/components/common/company-workspace/workspace.css',
  encapsulation: ViewEncapsulation.None,
})
export class IntegrationsWorkspaceComponent {
  private readonly api = inject(IntegrationsApi);
  private readonly auth = inject(AuthService);
  protected readonly section: IntegrationSection = inject(ActivatedRoute).snapshot.data['section'];
  protected readonly catalogue = rxResource({ stream: () => this.api.catalogue() });
  protected readonly errorMessage = apiErrorMessage;
  protected readonly labels = labels;
  protected readonly search = signal('');
  protected readonly inventory = computed(() => {
    const sources = this.catalogue.hasValue() ? this.catalogue.value().sources : [];
    return this.section.source ? sources.filter(entry => entry.source === this.section.source) : sources;
  });

  protected sourceSection(source: IntegrationSource) {
    return INTEGRATION_SECTIONS.find(section => section.source === source)!;
  }

  protected providerRows(source: Extract<IntegrationInventory, { status: 'AVAILABLE' }>) {
    const term = this.search().trim().toLowerCase();
    return source.providers.filter(row => [row.id, row.name, row.type, labels[row.state]]
      .some(value => value.toLowerCase().includes(term)));
  }

  protected canOpenOwner(section: IntegrationSection) {
    const permissions = this.auth.claims()?.permissions ?? [];
    if (section.source === 'NOTIFICATIONS' && !permissions.includes('platform:notifications:access')) return false;
    return !!section.ownerPath && (!section.ownerGrant || permissions.includes(section.ownerGrant));
  }
}
