import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, map, of, Subject, switchMap, tap } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { PageBreadcrumbComponent } from '../../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { BatchDetails, label } from '../domain/payslip-supervision.models';
import { PayslipSupervisionApi } from '../infrastructure/payslip-supervision-api';

@Component({
  selector: 'app-payslip-batch',
  standalone: true,
  imports: [RouterLink, DatePipe, DecimalPipe, PageBreadcrumbComponent, ComponentCardComponent],
  templateUrl: './payslip-batch.component.html',
  styleUrl: './payslip-supervision.css',
})
export class PayslipBatchComponent {
  private readonly api = inject(PayslipSupervisionApi);
  private readonly route = inject(ActivatedRoute);
  private readonly request = new Subject<{ companyId: number; id: string }>();
  protected readonly batch = signal<BatchDetails | null>(null);
  protected readonly busy = signal(true);
  protected readonly error = signal('');
  protected readonly label = label;

  constructor() {
    this.request.pipe(
      tap(() => { this.error.set(''); this.batch.set(null); this.busy.set(true); }),
      switchMap(({ companyId, id }) => this.api.batch(companyId, id).pipe(
        map(data => ({ data, error: '' })),
        catchError(error => of({ data: null, error: apiErrorMessage(error) })),
      )),
      takeUntilDestroyed(),
    ).subscribe(result => {
      this.batch.set(result.data);
      this.error.set(result.error);
      this.busy.set(false);
    });
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(() => this.refresh());
  }

  protected refresh() {
    const params = this.route.snapshot.paramMap;
    const companyId = Number(params.get('companyId'));
    const id = params.get('id');
    if (!id || !Number.isSafeInteger(companyId) || companyId < 1 || companyId > 2147483647) {
      this.error.set('Invalid batch reference.');
      this.busy.set(false);
      return;
    }
    this.request.next({ companyId, id });
  }

  protected pending(batch: BatchDetails) {
    return Math.max(0, batch.total - batch.completed - batch.failed);
  }
}
