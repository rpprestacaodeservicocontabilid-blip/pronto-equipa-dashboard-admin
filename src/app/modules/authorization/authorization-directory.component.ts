import { Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { apiErrorMessage } from '../../core/api/api-error';
import { ComponentCardComponent } from '../../shared/components/common/component-card/component-card.component';
import { PageBreadcrumbComponent } from '../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { AuthorizationAdminApi, AuthorizationPage, PermissionEntry, PermissionScope, RoleEntry } from './authorization-admin.api';
import { AuthorizationRoleListComponent } from './authorization-role-list.component';

type DirectoryFilter = { page: number; search: string; scope?: PermissionScope; companyId?: number };
type DirectoryResult =
  | { kind: 'permissions'; result: AuthorizationPage<PermissionEntry> }
  | { kind: 'roles'; result: AuthorizationPage<RoleEntry> };

@Component({
  selector: 'app-authorization-directory',
  standalone: true,
  imports: [FormsModule, RouterLink, ComponentCardComponent, PageBreadcrumbComponent, AuthorizationRoleListComponent],
  templateUrl: './authorization-directory.component.html',
})
export class AuthorizationDirectoryComponent {
  private readonly api = inject(AuthorizationAdminApi);
  private readonly route = inject(ActivatedRoute);
  readonly title: string = this.route.snapshot.data['title'];
  readonly view: 'permissions' | 'company-roles' | 'platform-roles' = this.route.snapshot.data['view'];
  private readonly linkedCompanyId = Number(this.route.snapshot.queryParamMap.get('companyId'));
  search = '';
  scope: PermissionScope | '' = '';
  companyId: number | null = Number.isSafeInteger(this.linkedCompanyId) && this.linkedCompanyId > 0 ? this.linkedCompanyId : null;
  private readonly filter = signal<DirectoryFilter>({
    page: 1, search: '', companyId: this.companyId ?? undefined,
  });
  readonly data = rxResource<DirectoryResult, DirectoryFilter | undefined>({
    params: () => {
      const filter = this.filter();
      return this.view === 'company-roles' && !filter.companyId ? undefined : filter;
    },
    stream: ({ params }) => this.view === 'permissions'
      ? this.api.permissions(params.page, params.search, params.scope).pipe(map(result => ({ kind: 'permissions' as const, result })))
      : this.api.roles(params.page, params.search, params.companyId).pipe(map(result => ({ kind: 'roles' as const, result }))),
  });
  readonly errorMessage = apiErrorMessage;

  canSimulate(permission: PermissionEntry) {
    return permission.scope !== 'GLOBAL' && /^[a-z][a-z0-9_-]*([.:][a-z][a-z0-9_-]*)+$/i.test(permission.name);
  }

  apply() {
    if (this.view === 'company-roles' && (!Number.isSafeInteger(this.companyId) || !this.companyId || this.companyId < 1)) return;
    this.filter.set({ page: 1, search: this.search.trim(), scope: this.scope || undefined, companyId: this.companyId ?? undefined });
  }

  paginate(page: number) {
    this.filter.update(filter => ({ ...filter, page }));
  }
}
