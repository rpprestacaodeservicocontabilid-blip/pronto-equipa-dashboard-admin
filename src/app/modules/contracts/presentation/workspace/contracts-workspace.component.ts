import { Component, ViewEncapsulation, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PageBreadcrumbComponent } from '../../../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { CONTRACT_VIEWS, ContractView } from '../../domain/contracts.models';
import type { WorkspaceContext } from '../../contracts.routes';
import { ContractsListComponent } from '../list/contracts-list.component';
import { ContractFormComponent } from '../form/contract-form.component';
import { ContractDetailComponent } from '../detail/contract-detail.component';
import { ContractTypesComponent } from '../types/contract-types.component';

@Component({
  selector: 'app-contracts-workspace',
  standalone: true,
  imports: [
    RouterLink, PageBreadcrumbComponent, ContractsListComponent, ContractFormComponent,
    ContractDetailComponent, ContractTypesComponent,
  ],
  encapsulation: ViewEncapsulation.None,
  styleUrl: '../../../../shared/components/common/company-workspace/workspace.css',
  templateUrl: './contracts-workspace.component.html',
})
export class ContractsWorkspaceComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly data = toSignal(this.route.data, { requireSync: true });
  private readonly params = toSignal(this.route.paramMap, { requireSync: true });
  protected readonly access = computed(() => this.data()['access'] as WorkspaceContext);
  protected readonly mode = computed(() => this.data()['mode'] as 'create' | 'edit' | 'detail' | undefined);
  protected readonly id = computed(() => this.params().get('id') ?? '');
  protected readonly section = computed(() => {
    const section = this.params().get('section') ?? 'dashboard';
    return Object.hasOwn(CONTRACT_VIEWS, section) ? section as ContractView : null;
  });
}
