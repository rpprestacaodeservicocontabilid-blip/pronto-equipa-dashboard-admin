import { Component, ViewEncapsulation, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { PageBreadcrumbComponent } from '../../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { canOpenEngineSection, ENGINE_SECTIONS, ENGINE_SIMULATION } from '../domain/engine-access';
import type { EngineAccess } from '../payroll-engine.routes';
import { EngineSimulationComponent } from './engine-simulation.component';
import { EngineTracesComponent } from './engine-traces.component';

@Component({
  selector: 'app-engine-workspace',
  standalone: true,
  imports: [RouterLink, PageBreadcrumbComponent, EngineSimulationComponent, EngineTracesComponent],
  styleUrl: '../../../shared/components/common/company-workspace/workspace.css',
  encapsulation: ViewEncapsulation.None,
  templateUrl: './engine-workspace.component.html',
})
export class EngineWorkspaceComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly company = toSignal(this.route.parent!.data.pipe(map(data => data['access'] as EngineAccess)), { requireSync: true });
  private readonly data = toSignal(this.route.data, { requireSync: true });
  protected readonly simulationId = ENGINE_SIMULATION;
  protected readonly section = computed(() => this.data()['section'] as typeof ENGINE_SECTIONS[number] | undefined);
  protected readonly state = computed(() => {
    const access = this.company();
    if ('error' in access) return access;
    const permissions = access.context.permissions;
    const allowed = ENGINE_SECTIONS.filter(section => canOpenEngineSection(section, permissions));
    const current = this.section();
    if (!allowed.length || (current && !canOpenEngineSection(current, permissions)))
      return { error: 'Your company role does not allow access to this payroll engine section.' };
    return { context: access.context, section: current ?? allowed[0] };
  });
}
