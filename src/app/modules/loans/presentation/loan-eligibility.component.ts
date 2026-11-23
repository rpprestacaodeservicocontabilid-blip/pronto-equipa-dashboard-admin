import { Component, Input, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReplaySubject, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { CompanyWorkspace } from '../../../core/api/company-workspace-api';
import { cents, money, today } from '../domain/loans-format';
import { hasGrant } from '../domain/loans-sections';
import { LoansApi } from '../infrastructure/loans-api.service';

@Component({
  selector: 'app-loan-eligibility',
  standalone: true,
  imports: [],
  template: `
    <section class="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
      <h4 class="font-semibold text-gray-900 dark:text-white">Employee checks</h4>
      @if (checks(); as result) {
        <dl class="mt-3 grid gap-3 sm:grid-cols-3">
          <div><dt class="font-medium">Employment status</dt><dd>{{ result.employee ?? 'Unavailable' }}</dd></div>
          <div><dt class="font-medium">Active contract</dt><dd>{{ result.contract ?? 'Unavailable' }}</dd></div>
          <div><dt class="font-medium">Open obligations</dt><dd>{{ result.obligations ?? 'Unavailable' }}</dd></div>
        </dl>
      } @else { <p class="mt-2" role="status">Checking available employee records…</p> }
      <p class="mt-3 text-xs text-gray-600 dark:text-gray-400">The server rechecks eligibility, obligations and the applicable policy on submission and approval.</p>
    </section>
  `,
})
export class LoanEligibilityComponent {
  @Input({ required: true }) context!: CompanyWorkspace;
  @Input({ required: true }) set employeeId(id: string) { this.employeeIds.next(id); }

  private readonly api = inject(LoansApi);
  private readonly employeeIds = new ReplaySubject<string>(1);
  protected readonly checks = toSignal(this.employeeIds.pipe(switchMap(id => {
    const { company, permissions } = this.context;
    const employee = permissions.includes('employees.read')
      ? this.api.employee(company.id, id).pipe(
        map(result => result.firstName + ' ' + result.lastName + ' · ' + result.status.toLowerCase()),
        catchError(() => of(undefined)),
      ) : of(undefined);
    const contract = permissions.includes('contracts.read')
      ? this.api.contracts(company.id, id).pipe(map(records => records.some(row =>
        row.startDate <= today() && (!row.endDate || row.endDate >= today())) ? 'On file' : 'None found'),
        catchError(() => of(undefined)),
      ) : of(undefined);
    const obligations = hasGrant(permissions, 'loans.read')
      ? this.api.all(page => this.api.loans(company.id, { employeeId: id }, page, 100)).pipe(
        map(rows => rows.filter(row => ['PENDING_DISBURSEMENT', 'ACTIVE', 'SUSPENDED'].includes(row.status))),
        map(rows => rows.length + ' · ' + money(rows.reduce((sum, row) =>
          sum + (cents(row.status === 'PENDING_DISBURSEMENT' ? row.principalAmount : row.balance.total) ?? 0n), 0n))),
        catchError(() => of(undefined)),
      ) : of(undefined);
    return forkJoin({ employee, contract, obligations });
  })));
}
