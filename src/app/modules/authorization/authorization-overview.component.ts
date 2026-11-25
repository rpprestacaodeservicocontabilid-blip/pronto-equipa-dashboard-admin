import { Component, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../core/api/api-error';
import { ComponentCardComponent } from '../../shared/components/common/component-card/component-card.component';
import { PageBreadcrumbComponent } from '../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { AuthorizationAdminApi } from './authorization-admin.api';

@Component({
  selector: 'app-authorization-overview',
  standalone: true,
  imports: [RouterLink, ComponentCardComponent, PageBreadcrumbComponent],
  template: `
    <app-page-breadcrumb pageTitle="Access overview" homeLink="/companies" />
    <app-component-card title="Access directory">
      @if (overview.isLoading()) {
        <p role="status" class="text-sm text-gray-600 dark:text-gray-400">Loading totals…</p>
      } @else if (overview.error(); as error) {
        <p role="alert" class="text-sm text-error-600 dark:text-error-400">{{ errorMessage(error) }}</p>
        <button type="button" (click)="overview.reload()" class="mt-3 text-sm text-brand-600 dark:text-brand-400">Retry</button>
      } @else if (overview.hasValue()) {
        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          @for (metric of metrics; track metric.key) {
            <a [routerLink]="metric.path"
              class="rounded-xl border border-gray-200 bg-gray-50 p-4 hover:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-brand-400">
              <span class="block text-sm text-gray-600 dark:text-gray-400">{{ metric.title }}</span>
              <span class="mt-2 block text-2xl font-semibold text-gray-900 dark:text-white">{{ overview.value()[metric.key] }}</span>
            </a>
          }
        </div>
      }
    </app-component-card>
  `,
})
export class AuthorizationOverviewComponent {
  private readonly api = inject(AuthorizationAdminApi);
  readonly overview = rxResource({ stream: () => this.api.overview() });
  readonly errorMessage = apiErrorMessage;
  readonly metrics = [
    { key: 'platformRoles', title: 'Global roles', path: '/authorization/platform-roles' },
    { key: 'companyRoles', title: 'Company-specific roles', path: '/authorization/company-roles' },
    { key: 'permissions', title: 'Catalogue entries', path: '/authorization/permissions' },
    { key: 'platformAssignments', title: 'Global role assignments', path: '/authorization/user-access' },
  ] as const;
}
