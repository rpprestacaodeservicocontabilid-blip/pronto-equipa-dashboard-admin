import { Component, ViewEncapsulation, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { combineLatest, map } from 'rxjs';
import { PageBreadcrumbComponent } from '../../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { AttendanceAccess } from '../attendance.routes';
import { ATTENDANCE_SECTIONS, can } from '../domain/attendance.sections';
import { AttendanceExplorerComponent } from './attendance-explorer.component';
import { AttendanceOperationsComponent } from './attendance-operations.component';

@Component({
  selector: 'app-attendance-workspace',
  standalone: true,
  imports: [PageBreadcrumbComponent, RouterLink, AttendanceExplorerComponent, AttendanceOperationsComponent],
  styleUrl: '../../../shared/components/common/company-workspace/workspace.css',
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="workspace-ui space-y-5">
      <app-page-breadcrumb [pageTitle]="section.title" homeLink="/attendance" />
      @if (view(); as state) {
        @if ('error' in state.access) {
          <p role="alert" class="feedback">{{ state.access.error }}</p>
          <a routerLink="/attendance" class="action">Select a company</a>
        } @else {
          @let context = state.access.context;
          <div class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-5 py-4 dark:border-gray-800 dark:bg-white/[0.03]">
            <div>
              <p class="text-sm text-gray-500 dark:text-gray-400">Attendance</p>
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">{{ context.company.name }}</h2>
            </div>
            <a routerLink="/attendance" class="action">Change company</a>
          </div>
          @let available = sectionsFor(context.permissions);
          @if (available.length) {
            @if (available.includes(section)) {
              @for (key of [context.company.id + ':' + state.id + ':' + state.employee + ':' + state.auditResource + ':' + state.auditAction]; track key) {
                @if (section.resource || section.path === 'overview') {
                  <app-attendance-explorer [context]="context" [section]="section" [id]="state.id" [employeeFilter]="state.employee" />
                } @else {
                  <app-attendance-operations [context]="context" [section]="section.path" [auditResource]="state.auditResource" [auditActionFilter]="state.auditAction" />
                }
              }
            } @else if (section.path === 'overview') {
              <a [routerLink]="['/attendance', context.company.id, available[0].path]" class="action action-primary">Open {{ available[0].title }}</a>
            } @else {
              <p role="alert" class="feedback">Your company permissions do not include this section.</p>
            }
          } @else {
            <p role="alert" class="feedback">Your company permissions do not include attendance management.</p>
          }
        }
      }
    </div>
  `,
})
export class AttendanceWorkspaceComponent {
  private readonly route = inject(ActivatedRoute);
  protected readonly section = this.route.snapshot.data['section'] as (typeof ATTENDANCE_SECTIONS)[number];
  protected readonly view = toSignal(combineLatest([this.route.parent!.data, this.route.paramMap, this.route.queryParamMap]).pipe(
    map(([data, params, query]) => ({
      access: data['access'] as AttendanceAccess, id: params.get('id') ?? '', employee: query.get('employee') ?? '',
      auditResource: query.get('resource') ?? '', auditAction: query.get('action') ?? '',
    })),
  ));

  protected sectionsFor(permissions: string[]) {
    return ATTENDANCE_SECTIONS.filter(section => section.permissions.some(permission => can(permissions, permission)));
  }
}
