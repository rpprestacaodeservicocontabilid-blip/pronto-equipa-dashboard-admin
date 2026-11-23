import { inject } from '@angular/core';
import { ResolveFn, Routes } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { apiErrorMessage } from '../../core/api/api-error';
import { CompanyWorkspace, CompanyWorkspaceApi } from '../../core/api/company-workspace-api';
import { ATTENDANCE_SECTIONS } from './domain/attendance.sections';

export type AttendanceAccess = { context: CompanyWorkspace } | { error: string };

const resolveCompany: ResolveFn<AttendanceAccess> = route => {
  const id = Number(route.paramMap.get('companyId'));
  if (!Number.isSafeInteger(id) || id < 1) return { error: 'Select a valid company.' };
  return inject(CompanyWorkspaceApi).context(id).pipe(
    map(context => ({ context })), catchError(error => of({ error: apiErrorMessage(error) })),
  );
};

const workspace = () => import('./presentation/attendance-workspace.component').then(m => m.AttendanceWorkspaceComponent);

export const ATTENDANCE_ROUTES: Routes = [
  {
    path: '', pathMatch: 'full', title: 'Select company | Attendance',
    data: { workspace: { label: 'Attendance', path: '/attendance' } },
    loadComponent: () => import('../../shared/components/common/company-workspace/company-workspace-picker.component')
      .then(module => module.CompanyWorkspacePickerComponent),
  },
  {
    path: ':companyId', resolve: { access: resolveCompany },
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      ...ATTENDANCE_SECTIONS.flatMap(section => {
        const route = { title: section.title + ' | Attendance', data: { section }, loadComponent: workspace };
        return [
          { path: section.path, ...route },
          ...(section.details ? [{ path: section.path + '/:id', ...route }] : []),
        ];
      }),
    ],
  },
];
