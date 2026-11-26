import { Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { contractErrorMessage } from '../contract-errors';
import { ComponentCardComponent } from '../../../../shared/components/common/component-card/component-card.component';
import { EmploymentContract, SalaryAssignment } from '../../domain/contracts.models';
import { ContractsApi } from '../../infrastructure/contracts-api.service';
import { contractAmount, formatContractDate } from '../format-contract';

@Component({
  selector: 'app-contract-salary',
  standalone: true,
  imports: [ComponentCardComponent],
  template: `
    <app-component-card i18n-title="@@contracts-salary-structure-assignments" title="Salary structure assignments">
      @if (error()) {
        <p class="feedback" role="alert">{{ error() }}</p>
        <button class="action" type="button" (click)="load()"><ng-container i18n="@@contracts-try-again">Try again</ng-container></button>
      } @else if (assignments(); as entries) {
        <ul class="divide-y divide-gray-200 dark:divide-gray-800">
          @for (entry of entries; track entry.id) {
            <li class="flex flex-wrap items-center justify-between gap-3 py-3 text-sm text-gray-700 dark:text-gray-300">
              <strong>{{ money(entry.baseSalary, entry.currency) }}</strong>
              <span>{{ date(entry.effectiveFrom) }} – {{ date(entry.effectiveTo) }}</span>
              <span>{{ status(entry.status) }}</span>
            </li>
          } @empty {
            <li class="text-sm text-gray-600 dark:text-gray-400"><ng-container i18n="@@contracts-there-are-no-salary-assignments-for-this-contract">There are no salary assignments for this contract.</ng-container></li>
          }
        </ul>
      } @else {
        <p role="status" class="text-sm text-gray-600 dark:text-gray-400"><ng-container i18n="@@contracts-loading-salary-assignments">Loading salary assignments…</ng-container></p>
      }
    </app-component-card>
  `,
})
export class ContractSalaryComponent implements OnInit {
  @Input({ required: true }) companyId!: number;
  @Input({ required: true }) contract!: EmploymentContract;
  private readonly api = inject(ContractsApi);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly assignments = signal<SalaryAssignment[] | null>(null);
  protected readonly error = signal('');
  protected readonly money = contractAmount;
  protected readonly date = formatContractDate;

  protected status(value: string) {
    if (value === 'ACTIVE') return $localize`:@@contracts-active:Active`;
    if (value === 'INACTIVE') return $localize`:@@contracts-inactive:Inactive`;
    return value;
  }

  ngOnInit() { this.load(); }

  protected load() {
    const { employeeId, id } = this.contract;
    this.error.set('');
    this.api.salaryAssignments(this.companyId, employeeId, id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: assignments => this.assignments.set(assignments),
      error: error => this.error.set(contractErrorMessage(error)),
    });
  }
}
