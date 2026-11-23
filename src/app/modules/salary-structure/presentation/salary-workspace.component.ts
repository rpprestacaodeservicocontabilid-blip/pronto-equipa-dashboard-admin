import { Component, ViewEncapsulation, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { combineLatest, map } from 'rxjs';
import { PageBreadcrumbComponent } from '../../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { SECTIONS, Section, can } from '../domain/salary-sections';
import { SalaryAccess } from '../salary-structure.routes';
import { SalaryBatchComponent } from './salary-batch.component';
import { SalaryCatalogComponent } from './salary-catalog.component';
import { SalaryControlComponent } from './salary-control.component';
import { SalaryDashboardComponent } from './salary-dashboard.component';
import { SalaryHistoryComponent } from './salary-history.component';
import { SalaryPeopleComponent } from './salary-people.component';
import { SalaryReportsComponent } from './salary-reports.component';
import { SalarySimulationComponent } from './salary-simulation.component';

@Component({
  selector: 'app-salary-workspace',
  standalone: true,
  imports: [PageBreadcrumbComponent, RouterLink, SalaryBatchComponent, SalaryCatalogComponent, SalaryControlComponent,
    SalaryDashboardComponent, SalaryHistoryComponent, SalaryPeopleComponent, SalaryReportsComponent, SalarySimulationComponent],
  templateUrl: './salary-workspace.component.html',
  styleUrl: '../../../shared/components/common/company-workspace/workspace.css',
  encapsulation: ViewEncapsulation.None,
})
export class SalaryWorkspaceComponent {
  private readonly route = inject(ActivatedRoute);
  protected readonly section = this.route.snapshot.data['section'] as Section;
  protected readonly state = toSignal(combineLatest([this.route.parent!.data, this.route.paramMap, this.route.queryParamMap]).pipe(
    map(([data, params, query]) => ({
      access: data['access'] as SalaryAccess, id: params.get('id') ?? '', employee: query.get('employee') ?? '',
      resource: query.get('resource') ?? '', status: query.get('status') ?? '',
    })),
  ));
  protected byGrant(permissions: string[]) { return SECTIONS.filter(section => section.grants.some(grant => can(permissions, grant))); }
  protected peopleMode() { return this.section.path === 'assignments' ? 'assignments' : 'revisions'; }
  protected controlMode() { return this.section.path === 'audit' ? 'audit' : this.section.path === 'settings' ? 'settings' : 'policies'; }
}
