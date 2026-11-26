import { Component, ViewEncapsulation, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, catchError, map, of, startWith, switchMap } from 'rxjs';
import { apiErrorMessage } from '../../../../core/api/api-error';
import { PageBreadcrumbComponent } from '../page-breadcrumb/page-breadcrumb.component';
import { ComponentCardComponent } from '../component-card/component-card.component';
import { CompanyWorkspaceApi } from '../../../../core/api/company-workspace-api';
import { SIDEBAR_MODULES } from '../../../../navigation/sidebar-navigation';

@Component({
  selector: 'app-company-workspace-picker',
  standalone: true,
  imports: [RouterLink, PageBreadcrumbComponent, ComponentCardComponent],
  styleUrl: './workspace.css',
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="workspace-ui">
      <app-page-breadcrumb [pageTitle]="feature.label" [homeLink]="feature.path" />
      <app-component-card i18n-title="@@company-picker-select-a-company" i18n-desc="@@company-picker-choose-one-of-your-active-companies" title="Select a company" desc="Choose one of your active companies.">
        @let state = companies();
        @if (!state) {
          <p role="status" class="text-sm text-gray-600 dark:text-gray-400"><ng-container i18n="@@company-picker-loading-companies">Loading companies…</ng-container></p>
        } @else if ('error' in state) {
          <p role="alert" class="feedback mb-3">{{ state.error }}</p>
          <button type="button" class="action" (click)="reload.next()"><ng-container i18n="@@company-picker-try-again">Try again</ng-container></button>
        } @else {
          <ul class="grid gap-3 sm:grid-cols-2">
            @for (company of state.companies; track company.id) {
              <li>
                @if (company.status === 'ACTIVE') {
                  <a [routerLink]="companyPath(company.id)" class="action w-full justify-between">
                    <span>{{ company.name }}</span>
                    <span class="text-brand-600 dark:text-brand-400"><ng-container i18n="@@company-picker-workspace-open">Open {{ feature.label }}</ng-container> <span aria-hidden="true" class="inline-block rtl:rotate-180">→</span></span>
                  </a>
                } @else {
                  <p class="action w-full justify-between opacity-60">{{ company.name }} <span>{{ companyStatus(company.status) }}</span></p>
                }
              </li>
            } @empty {
              <li class="text-sm text-gray-600 dark:text-gray-400"><ng-container i18n="@@company-picker-no-companies-are-available-for-this-account">No companies are available for this account.</ng-container></li>
            }
          </ul>
        }
      </app-component-card>
    </div>
  `,
})
export class CompanyWorkspacePickerComponent {
  private readonly api = inject(CompanyWorkspaceApi);
  private readonly route = inject(ActivatedRoute);
  protected readonly feature = this.route.snapshot.data['workspace'] as { label: string; path: string };
  private readonly query = toSignal(this.route.queryParamMap, { requireSync: true });
  private readonly section = computed(() => {
    const requested = this.query().get('section');
    const feature = SIDEBAR_MODULES.find(item => '/' + item.id === this.feature.path);
    return feature?.links.find(link => link.id === requested)?.id;
  });
  protected companyPath(companyId: number) {
    const section = this.section();
    return section ? [this.feature.path, companyId, section] : [this.feature.path, companyId];
  }
  protected companyStatus(status: string) {
    if (status === 'SUSPENDED') return $localize`:@@company-picker-suspended:Suspended`;
    if (status === 'INACTIVE') return $localize`:@@company-picker-inactive:Inactive`;
    return status;
  }
  protected readonly reload = new Subject<void>();
  protected readonly companies = toSignal(this.reload.pipe(
    startWith(undefined),
    switchMap(() => this.api.companies().pipe(
      map(companies => ({ companies })),
      catchError(error => of({ error: apiErrorMessage(error) })),
      startWith(undefined),
    )),
  ));
}
