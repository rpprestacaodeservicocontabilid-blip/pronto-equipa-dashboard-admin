import { Routes } from '@angular/router';
import { PAYSLIP_SECTIONS } from './domain/payslip-supervision.navigation';

export const PAYSLIP_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'overview' },
  ...PAYSLIP_SECTIONS.map(section => ({
    path: section.path, title: section.title + ' · Payslips | PRONTOEQUIPAS', data: { section },
    loadComponent: () => import('./presentation/payslip-supervision.component').then(m => m.PayslipSupervisionComponent),
  })),
  { path: 'batches/:companyId/:id', title: 'Batch details · Payslips | PRONTOEQUIPAS',
    loadComponent: () => import('./presentation/payslip-batch.component').then(m => m.PayslipBatchComponent) },
];
