import { DatePipe } from '@angular/common';
import { Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { ApiPage, CompanyWorkspace } from '../../../../core/api/company-workspace-api';
import { apiErrorMessage } from '../../../../core/api/api-error';
import { ComponentCardComponent } from '../../../../shared/components/common/component-card/component-card.component';
import { LeaveDirectory } from '../../application/leave-directory';
import { Entitlement, LeaveAccount, LeaveBalance, MOVEMENTS, Movement, MovementType } from '../../domain/leave.models';
import { dateKey, validRange } from '../../domain/leave-rules';
import { LeaveApi } from '../../infrastructure/leave-api.service';

type Operation = 'accrue' | 'recalculate' | 'adjust';

@Component({
  selector: 'app-leave-balances',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, ComponentCardComponent],
  templateUrl: './leave-balances.component.html',
})
export class LeaveBalancesComponent implements OnInit {
  @Input({ required: true }) context!: CompanyWorkspace;
  @Input() id = '';
  private readonly api = inject(LeaveApi);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  protected readonly directory = inject(LeaveDirectory);
  protected readonly rows = signal<ApiPage<LeaveAccount> | null>(null);
  protected readonly balances = signal(new Map<string, LeaveBalance>());
  protected readonly account = signal<LeaveAccount | null>(null);
  protected readonly balance = signal<LeaveBalance | null>(null);
  protected readonly entitlements = signal<Entitlement[]>([]);
  protected readonly movements = signal<ApiPage<Movement> | null>(null);
  protected readonly movementTypes = MOVEMENTS;
  protected readonly loading = signal(false);
  protected readonly movementLoading = signal(false);
  protected readonly error = signal('');
  protected readonly movementError = signal('');
  protected readonly notice = signal('');
  protected readonly saving = signal(false);
  protected readonly create = signal(false);
  protected readonly operation = signal<Operation | null>(null);
  protected employee = '';
  protected newEmployee = '';
  protected movementType: MovementType | '' = '';
  protected from = dateKey().slice(0, 4) + '-01-01';
  protected to = dateKey().slice(0, 4) + '-12-31';
  protected days: number | null = null;
  protected reason = '';
  protected legalVersion = '';
  protected reference = '';

  ngOnInit() { if (this.id) this.detail(); else this.list(1); }
  protected has(permission: string) { return this.context.permissions.includes(permission); }

  protected list(page: number) {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    const company = this.context.company.id;
    this.api.accounts(company, this.employee, page).pipe(
      switchMap(rows => rows.data.length ? forkJoin(rows.data.map(row =>
        this.api.balance(company, row.id).pipe(catchError(() => of(null))),
      )).pipe(map(balances => ({ rows, balances }))) : of({ rows, balances: [] })),
      takeUntilDestroyed(this.destroy),
    ).subscribe({
      next: ({ rows, balances }) => {
        this.rows.set(rows);
        this.balances.set(new Map(balances.filter((entry): entry is LeaveBalance => !!entry).map(entry => [entry.accountId, entry])));
        this.loading.set(false);
      },
      error: error => { this.error.set(apiErrorMessage(error)); this.loading.set(false); },
    });
  }

  protected detail() {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    const company = this.context.company.id;
    forkJoin({
      account: this.api.account(company, this.id), balance: this.api.balance(company, this.id),
      entitlements: this.api.entitlements(company, this.id),
    }).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: result => {
        this.account.set(result.account);
        this.balance.set(result.balance);
        this.entitlements.set(result.entitlements);
        this.loading.set(false);
        this.loadMovements(1);
      },
      error: error => { this.error.set(apiErrorMessage(error)); this.loading.set(false); },
    });
  }

  protected loadMovements(page: number) {
    if (this.movementLoading()) return;
    this.movementError.set('');
    this.movementLoading.set(true);
    this.api.movements(this.context.company.id, this.id, page, this.movementType).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: movements => { this.movements.set(movements); this.movementLoading.set(false); },
      error: error => { this.movementError.set(apiErrorMessage(error)); this.movementLoading.set(false); },
    });
  }

  protected createAccount() {
    if (!this.newEmployee || this.saving() || !this.has('leave.accounts.manage')) return;
    this.error.set('');
    this.saving.set(true);
    const company = this.context.company.id;
    this.api.createAccount(company, this.newEmployee).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: account => { this.saving.set(false); void this.router.navigate(['/leave', company, 'balances', account.id]); },
      error: error => { this.error.set(apiErrorMessage(error)); this.saving.set(false); },
    });
  }

  protected open(operation: Operation) {
    this.days = null;
    this.reason = '';
    this.reference = '';
    this.legalVersion = '';
    this.error.set('');
    this.notice.set('');
    this.operation.set(operation);
  }

  protected save() {
    const op = this.operation();
    const days = this.days;
    if (!op || this.saving() || this.account()?.status !== 'ACTIVE') return;
    const company = this.context.company.id;
    this.error.set('');
    if (!Number.isInteger(days) || !days) { this.error.set('Enter a non-zero whole number of days.'); return; }
    const adjustment = op === 'adjust';
    if (!this.has(adjustment ? 'leave.balance.adjust' : 'leave.entitlements.manage')) return;
    if (adjustment && (Math.abs(days) > 3660 || !this.reason.trim() ||
        this.reference.trim() && !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(this.reference.trim()))) {
      this.error.set('Enter a reason, an adjustment up to 3660 days and a valid optional reference UUID.');
      return;
    }
    if (!adjustment && (days < 1 || days > 366 || !validRange(this.from, this.to))) {
      this.error.set('Enter between 1 and 366 days and a valid accrual period.');
      return;
    }
    const request = adjustment
      ? this.api.adjust(company, this.id, days, this.reason.trim(), this.reference.trim() || null)
      : this.api.entitlement(company, this.id, {
        accrualPeriodStart: this.from, accrualPeriodEnd: this.to, days, legalRuleVersionId: this.legalVersion.trim() || null,
      }, op === 'recalculate');
    this.saving.set(true);
    request.pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: () => {
        this.saving.set(false);
        this.operation.set(null);
        this.notice.set('The operation was recorded in the account ledger.');
        this.detail();
      },
      error: error => { this.error.set(apiErrorMessage(error)); this.saving.set(false); },
    });
  }
}
