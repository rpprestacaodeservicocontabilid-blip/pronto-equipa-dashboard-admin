import { Component, ViewEncapsulation, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { PageBreadcrumbComponent } from '../../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { isPayrollId } from '../domain/payroll-format';
import { canOpenPayrollSection, PayrollSection } from '../domain/payroll-sections';
import { PayrollAccess } from '../payroll.routes';
import { PayrollOverviewComponent } from './payroll-overview.component';
import { PayrollPeriodsComponent } from './payroll-periods.component';
import { PayrollReportsComponent } from './payroll-reports.component';
import { PayrollRunComponent } from './payroll-run.component';
import { PayrollRunFormComponent } from './payroll-run-form.component';
import { PayrollRunsComponent } from './payroll-runs.component';
import { PayrollSettingsComponent } from './payroll-settings.component';

@Component({
  selector: 'app-payroll-workspace',
  standalone: true,
  imports: [
    RouterLink, PageBreadcrumbComponent, PayrollOverviewComponent, PayrollPeriodsComponent, PayrollReportsComponent,
    PayrollRunComponent, PayrollRunFormComponent, PayrollRunsComponent, PayrollSettingsComponent,
  ],
  styleUrl: '../../../shared/components/common/company-workspace/workspace.css',
  encapsulation: ViewEncapsulation.None,
  templateUrl: './payroll-workspace.component.html',
})
export class PayrollWorkspaceComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly access = toSignal(this.route.parent!.data.pipe(map(data => data['access'] as PayrollAccess)), { requireSync: true });
  private readonly params = toSignal(this.route.paramMap, { requireSync: true });
  private readonly data = toSignal(this.route.data, { requireSync: true });
  protected readonly section = computed(() => this.data()['section'] as PayrollSection);
  protected readonly view = computed(() => {
    const access = this.access();
    const section = this.section();
    const id = this.params().get('id') ?? '';
    const create = this.data()['create'] === true;
    if ('error' in access) return access;
    if (access.context.company.status !== 'ACTIVE') return { error: 'Select an active company to use Payroll.' };
    if (!canOpenPayrollSection(section, access.context.permissions)) return { error: 'Your company role does not allow access to this payroll section.' };
    if (id && !isPayrollId(id)) return { error: 'This payroll record identifier is invalid.' };
    return { context: access.context, section, id, create };
  });
}
