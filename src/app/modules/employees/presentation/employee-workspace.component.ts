import { Component, ViewEncapsulation, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink, RouterLinkActive } from '@angular/router';
import { PageBreadcrumbComponent } from '../../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { EMPLOYEE_PROFILE, EMPLOYEE_SECTIONS, EmployeeSection, hasEmployeeGrants } from '../domain/employee-navigation';
import type { EmployeeAccess } from '../employees.routes';
import { EmployeeDirectoryComponent } from './employee-directory.component';
import { EmployeeRegistrationComponent } from './employee-registration.component';
import { EmployeeProfileComponent } from './employee-profile.component';
import { EmployeeComplementaryComponent } from './employee-complementary.component';
import { EmployeeDraftsComponent } from './employee-drafts.component';

@Component({
  standalone: true,
  imports: [RouterLink, RouterLinkActive, PageBreadcrumbComponent, EmployeeDirectoryComponent, EmployeeRegistrationComponent,
    EmployeeProfileComponent, EmployeeComplementaryComponent, EmployeeDraftsComponent],
  styleUrl: '../../../shared/components/common/company-workspace/workspace.css',
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="workspace-ui space-y-5">
      <app-page-breadcrumb [pageTitle]="section.title" homeLink="/employees" />
      @if (accessError()) {
        <p role="alert" class="feedback">{{ accessError() }}</p>
        <a routerLink="/employees" class="action"><ng-container i18n="@@employees-choose-a-company">Choose a company</ng-container></a>
      } @else if (context(); as scope) {
        <div class="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p class="font-medium text-gray-800 dark:text-gray-200">{{ scope.company.name }}</p>
          <a routerLink="/employees" [queryParams]="{ section: employeeId() ? 'all' : section.path }" class="action"><ng-container i18n="@@employees-change-company">Change company</ng-container></a>
        </div>
        <nav [attr.aria-label]="employeeId() ? copy.profile : copy.employees" class="flex flex-wrap gap-1">
          @for (tab of tabs(); track tab.path) {
            <a [routerLink]="tabLink(tab.path)" routerLinkActive ariaCurrentWhenActive="page"
              [routerLinkActiveOptions]="{ exact: true }" class="section-link">{{ tab.title }}</a>
          }
        </nav>
        @for (key of [scope.company.id + ':' + employeeId()]; track key) {
          @switch (section.view) {
            @case ('new') {
              @if (canReviewDirectory()) {
                <a [routerLink]="['/employees', scope.company.id, 'registrations']" class="action"><ng-container i18n="@@employees-open-drafts-and-reviews">Open drafts and reviews</ng-container></a>
              }
              <app-employee-registration [company]="scope.company.id" [canRead]="canRead()" />
            }
            @case ('imports') { <app-employee-registration [company]="scope.company.id" mode="imports" /> }
            @case ('overview') { <app-employee-directory [company]="scope.company.id" view="overview" /> }
            @case ('directory') { <app-employee-directory [company]="scope.company.id" [preset]="section.status" [admissions]="section.path === 'admissions'" /> }
            @case ('exports') { <app-employee-directory [company]="scope.company.id" view="exports" /> }
            @case ('reports') { <app-employee-directory [company]="scope.company.id" view="reports" /> }
            @case ('registrations') { <app-employee-drafts [company]="scope.company.id" [permissions]="scope.permissions" /> }
            @case ('complementary') {
              <app-employee-complementary [company]="scope.company.id" [employee]="employeeId()" [section]="section.profileSection!" [permissions]="scope.permissions" />
            }
            @default { <app-employee-profile [company]="scope.company.id" [employeeId]="employeeId()" [permissions]="scope.permissions" [view]="section.view" /> }
          }
        }
      }
    </div>
  `,
})
export class EmployeeWorkspaceComponent {
  protected readonly copy = {
    profile: $localize`:@@employees-employee-profile:Employee profile`,
    employees: $localize`:@@employees-employees:Employees`,
  };

  private readonly route = inject(ActivatedRoute);
  private readonly data = toSignal(this.route.data, { requireSync: true });
  private readonly params = toSignal(this.route.paramMap, { requireSync: true });
  protected readonly section: EmployeeSection = this.route.snapshot.data['section'];
  protected readonly context = computed(() => {
    const access = this.data()['access'] as EmployeeAccess;
    return 'context' in access ? access.context : undefined;
  });
  protected readonly employeeId = computed(() => this.params().get('employeeId') ?? '');
  protected readonly canRead = computed(() => this.context()?.permissions.includes('employees.read') ?? false);
  protected readonly canReviewDirectory = computed(() =>
    hasEmployeeGrants(this.context()?.permissions ?? [], ['employees.read', 'employees.personal.read']));
  protected readonly tabs = computed(() => (this.employeeId() ? EMPLOYEE_PROFILE : EMPLOYEE_SECTIONS)
    .filter(tab => hasEmployeeGrants(this.context()?.permissions ?? [], tab.grants)));
  protected readonly accessError = computed(() => {
    const access = this.data()['access'] as EmployeeAccess;
    if ('error' in access) return access.error;
    if (access.context.company.status !== 'ACTIVE' || !hasEmployeeGrants(access.context.permissions, this.section.grants)) {
      return $localize`:@@employees-this-section-requires-employee-permissions-for-the-selected-company:This section requires employee permissions for the selected company.`;
    }
    if (this.employeeId() && !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(this.employeeId())) {
      return $localize`:@@employees-invalid-employee-identifier:Invalid employee identifier.`;
    }
    return '';
  });
  protected tabLink(path: string) {
    const link = ['/employees', this.context()!.company.id];
    if (this.employeeId()) link.push('details', this.employeeId());
    if (path) link.push(path);
    return link;
  }
}
