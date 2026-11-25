import { Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { apiErrorMessage } from '../../core/api/api-error';
import { ComponentCardComponent } from '../../shared/components/common/component-card/component-card.component';
import { PageBreadcrumbComponent } from '../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { AuthorizationAdminApi, SimulationResult, UserAccess } from './authorization-admin.api';
import { AuthorizationRoleListComponent } from './authorization-role-list.component';

type Result = { kind: 'simulation'; result: SimulationResult } | { kind: 'access'; result: UserAccess };
type Lookup = { userId: number; companyId?: number; permissionId?: number };

@Component({
  selector: 'app-authorization-user-access',
  standalone: true,
  imports: [FormsModule, RouterLink, ComponentCardComponent, PageBreadcrumbComponent, AuthorizationRoleListComponent],
  templateUrl: './authorization-user-access.component.html',
})
export class AuthorizationUserAccessComponent {
  private readonly api = inject(AuthorizationAdminApi);
  private readonly route = inject(ActivatedRoute);
  readonly title: string = this.route.snapshot.data['title'];
  readonly simulator = this.route.snapshot.data['view'] === 'simulator';
  userId = this.linkedId('userId');
  companyId = this.linkedId('companyId');
  permissionId = this.linkedId('permissionId');
  scope: 'PLATFORM' | 'TENANT' = this.companyId || this.route.snapshot.queryParamMap.get('scope') === 'TENANT' ? 'TENANT' : 'PLATFORM';
  private readonly lookup = signal<Lookup | undefined>(
    !this.simulator && this.userId ? { userId: this.userId, companyId: this.companyId ?? undefined } : undefined,
  );
  readonly data = rxResource<Result, Lookup | undefined>({
    params: () => this.lookup(),
    stream: ({ params }) => params.permissionId
      ? this.api.simulate(params.userId, params.permissionId, params.companyId).pipe(map(result => ({ kind: 'simulation' as const, result })))
      : this.api.userAccess(params.userId, params.companyId).pipe(map(result => ({ kind: 'access' as const, result }))),
  });
  readonly errorMessage = apiErrorMessage;

  submit() {
    const userId = this.userId;
    const companyId = this.scope === 'TENANT' ? this.companyId ?? undefined : undefined;
    const permissionId = this.simulator ? this.permissionId ?? undefined : undefined;
    if (!userId || !Number.isSafeInteger(userId) || userId < 1) return;
    if (this.scope === 'TENANT' && (!companyId || !Number.isSafeInteger(companyId) || companyId < 1)) return;
    if (this.simulator && (!permissionId || !Number.isSafeInteger(permissionId) || permissionId < 1)) return;
    this.lookup.set({ userId, companyId, permissionId });
  }

  private linkedId(key: string) {
    const id = Number(this.route.snapshot.queryParamMap.get(key));
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  }
}
