import { Component, ViewEncapsulation, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PageBreadcrumbComponent } from '../../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { ORGANIZATION_RESOURCES } from '../domain/organization.resources';
import { Resource } from '../domain/organization.models';
import type { OrganizationAccess } from '../organization.routes';
import { OrganizationDashboardComponent } from './organization-dashboard.component';
import { OrganizationHierarchyComponent } from './hierarchy/organization-hierarchy.component';
import { OrganizationResourceComponent } from './records/organization-resource.component';
import { OrganizationAllocationsComponent } from './allocations/organization-allocations.component';
import { OrganizationHistoryComponent } from './history/organization-history.component';
import { OrganizationAuditComponent } from './history/organization-audit.component';

@Component({
  selector: 'app-organization-workspace',
  standalone: true,
  imports: [RouterLink, PageBreadcrumbComponent, OrganizationDashboardComponent, OrganizationHierarchyComponent,
    OrganizationResourceComponent, OrganizationAllocationsComponent, OrganizationHistoryComponent, OrganizationAuditComponent],
  encapsulation: ViewEncapsulation.None,
  styleUrl: '../../../shared/components/common/company-workspace/workspace.css',
  templateUrl: './organization-workspace.component.html',
})
export class OrganizationWorkspaceComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly data = toSignal(this.route.data, { requireSync: true });
  private readonly parameters = toSignal(this.route.paramMap, { requireSync: true });
  protected readonly access = computed(() => this.data()['access'] as OrganizationAccess);
  protected readonly section = computed(() => this.parameters().get('section') ?? 'overview');
  protected readonly id = computed(() => this.parameters().get('id') ?? '');
  protected readonly resource = computed<Resource | null>(() => {
    const section = this.section() === 'shifts' ? 'schedules' : this.section();
    return Object.hasOwn(ORGANIZATION_RESOURCES, section) ? section as Resource : null;
  });
}
