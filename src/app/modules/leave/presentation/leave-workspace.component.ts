import { Component, ViewEncapsulation, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PageBreadcrumbComponent } from '../../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { LeaveDirectory } from '../application/leave-directory';
import { LEAVE_SECTIONS } from '../domain/leave-sections';
import type { LeaveAccess } from '../leave.routes';
import { LeaveRequestsComponent } from './requests/leave-requests.component';
import { LeaveRequestDetailComponent } from './requests/leave-request-detail.component';
import { LeaveDraftComponent } from './requests/leave-draft.component';
import { LeaveBalancesComponent } from './balances/leave-balances.component';
import { LeavePlanningComponent, LeavePlanningMode } from './planning/leave-planning.component';
import { LeaveConflictsComponent } from './planning/leave-conflicts.component';
import { LeaveReportsComponent } from './reports/leave-reports.component';
import { LeaveAuditComponent } from './reports/leave-audit.component';

@Component({
  selector: 'app-leave-workspace',
  standalone: true,
  imports: [RouterLink, PageBreadcrumbComponent, LeaveRequestsComponent, LeaveRequestDetailComponent, LeaveDraftComponent,
    LeaveBalancesComponent, LeavePlanningComponent, LeaveConflictsComponent, LeaveReportsComponent, LeaveAuditComponent],
  providers: [LeaveDirectory],
  encapsulation: ViewEncapsulation.None,
  styleUrl: '../../../shared/components/common/company-workspace/workspace.css',
  templateUrl: './leave-workspace.component.html',
})
export class LeaveWorkspaceComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly directory = inject(LeaveDirectory);
  private readonly data = toSignal(this.route.data, { requireSync: true });
  private readonly params = toSignal(this.route.paramMap, { requireSync: true });
  protected readonly access = computed(() => this.data()['access'] as LeaveAccess);
  protected readonly section = computed(() => this.params().get('section') ?? 'overview');
  protected readonly planningMode = computed<LeavePlanningMode | null>(() => {
    const section = this.section();
    return section === 'overview' || section === 'calendar' || section === 'plans' ? section : null;
  });
  protected readonly id = computed(() => this.params().get('id') ?? '');
  private directoryCompany: number | null = null;
  private directoryGrants = '';

  constructor() {
    effect(() => {
      const access = this.access();
      if ('context' in access && LEAVE_SECTIONS.some(entry => entry.path !== 'history' &&
          entry.grants.some(grant => access.context.permissions.includes(grant)))) {
        const context = access.context;
        const grants = [...context.permissions].sort().join(',');
        if (context.company.id !== this.directoryCompany || grants !== this.directoryGrants) {
          this.directoryCompany = context.company.id;
          this.directoryGrants = grants;
          this.directory.load(context);
        }
      } else {
        this.directoryCompany = null;
      }
    });
  }

  protected hasAccess(grants: string[], section: string) {
    return LEAVE_SECTIONS.some(entry => entry.path === section && entry.grants.some(grant => grants.includes(grant)));
  }
}
