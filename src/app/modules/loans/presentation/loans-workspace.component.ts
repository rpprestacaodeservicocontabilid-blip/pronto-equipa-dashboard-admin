import { Component, ViewEncapsulation, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { combineLatest, map } from 'rxjs';
import { PageBreadcrumbComponent } from '../../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { LOAN_SECTIONS, canOpen } from '../domain/loans-sections';
import { LoansAccess } from '../loans.routes';
import { LoanApplicationComponent } from './loan-application.component';
import { LoanAuditComponent } from './loan-audit.component';
import { LoanCollectionsComponent } from './loan-collections.component';
import { LoanDashboardComponent } from './loan-dashboard.component';
import { LoanDetailsComponent } from './loan-details.component';
import { LoanPoliciesComponent } from './loan-policies.component';
import { LoanRegisterComponent } from './loan-register.component';

@Component({
  selector: 'app-loans-workspace',
  standalone: true,
  imports: [
    RouterLink, PageBreadcrumbComponent, LoanApplicationComponent, LoanAuditComponent, LoanCollectionsComponent,
    LoanDashboardComponent, LoanDetailsComponent, LoanPoliciesComponent, LoanRegisterComponent,
  ],
  styleUrl: '../../../shared/components/common/company-workspace/workspace.css',
  encapsulation: ViewEncapsulation.None,
  templateUrl: './loans-workspace.component.html',
})
export class LoansWorkspaceComponent {
  private readonly route = inject(ActivatedRoute);
  protected readonly section = this.route.snapshot.data['section'] as (typeof LOAN_SECTIONS)[number];
  protected readonly view = toSignal(combineLatest([this.route.parent!.data, this.route.paramMap, this.route.queryParamMap]).pipe(
    map(([data, params, query]) => ({
      access: data['access'] as LoansAccess, id: params.get('id') ?? '', query,
      queryKey: JSON.stringify(query.keys.map(key => [key, query.get(key)])),
    })),
  ));

  protected sections(permissions: string[]) {
    return LOAN_SECTIONS.filter(section => canOpen(section, permissions));
  }
  protected collectionMode() {
    return this.section.path === 'deductions' || this.section.path === 'overdue' ? this.section.path : 'reports';
  }
}
