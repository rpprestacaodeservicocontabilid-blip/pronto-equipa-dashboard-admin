import { Component, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { apiErrorMessage } from '../../core/api/api-error';
import { ComponentCardComponent } from '../../shared/components/common/component-card/component-card.component';
import { PageBreadcrumbComponent } from '../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { CompaniesService } from './companies.service';

@Component({
  selector: 'app-tenancy-overview',
  standalone: true,
  imports: [RouterLink, ComponentCardComponent, PageBreadcrumbComponent],
  template: `
    <app-page-breadcrumb pageTitle="Tenancy overview" homeLink="/companies" />
    <app-component-card title="Company status">
      @if (summary.isLoading()) {
        <p role="status" class="text-sm text-gray-600 dark:text-gray-400">Loading company totals…</p>
      }
      @if (summary.error(); as error) {
        <p role="alert" class="text-sm text-error-600 dark:text-error-400">{{ errorMessage(error) }}</p>
        <button type="button" (click)="summary.reload()" class="mt-3 text-sm text-brand-600 dark:text-brand-400">Retry</button>
      }
      @if (summary.hasValue()) {
        <div class="grid gap-4 sm:grid-cols-3">
          @for (metric of metrics; track metric.path) {
            <a [routerLink]="metric.path"
              class="rounded-xl border border-gray-200 bg-gray-50 p-4 hover:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-brand-400">
              <span class="block text-sm text-gray-600 dark:text-gray-400">{{ metric.title }}</span>
              <span class="mt-2 block text-2xl font-semibold text-gray-900 dark:text-white">{{ summary.value()[metric.key] }}</span>
            </a>
          }
        </div>
      }
    </app-component-card>
    <div class="mt-5">
      <app-component-card title="Related operations">
        <div class="flex flex-wrap gap-4 text-sm font-medium text-brand-600 dark:text-brand-400">
          <a routerLink="/onboarding/approvals" class="hover:underline">Review company applications</a>
          <a routerLink="/onboarding/provisioning" class="hover:underline">Monitor provisioning</a>
          <a routerLink="/subscriptions/directory" class="hover:underline">Manage subscriptions</a>
        </div>
      </app-component-card>
    </div>
  `,
})
export class TenancyOverviewComponent {
  private readonly companies = inject(CompaniesService);
  readonly summary = rxResource({ stream: () => this.companies.summary().pipe(map(response => response.data)) });
  readonly errorMessage = apiErrorMessage;
  readonly metrics = [
    { path: '/companies', title: $localize`:@@ui-i4yiur:All companies`, key: 'total' },
    { path: '/companies/active', title: $localize`:@@ui-1mljis0:Active companies`, key: 'active' },
    { path: '/companies/suspended', title: $localize`:@@ui-134xxyp:Suspended companies`, key: 'suspended' },
  ] as const;
}
