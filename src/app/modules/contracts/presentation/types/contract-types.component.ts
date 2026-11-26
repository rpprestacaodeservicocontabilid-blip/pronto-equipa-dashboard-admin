import { Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { contractErrorMessage } from '../contract-errors';
import { ComponentCardComponent } from '../../../../shared/components/common/component-card/component-card.component';
import { CompanyContext, ContractType } from '../../domain/contracts.models';
import { ContractsApi } from '../../infrastructure/contracts-api.service';

@Component({
  selector: 'app-contract-types',
  standalone: true,
  imports: [FormsModule, ComponentCardComponent],
  templateUrl: './contract-types.component.html',
})
export class ContractTypesComponent implements OnInit {
  @Input({ required: true }) context!: CompanyContext;

  private readonly api = inject(ContractsApi);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly types = signal<ContractType[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly showForm = signal(false);
  protected code = '';
  protected name = '';
  protected ruleVersion = '';
  protected requiresEndDate = true;
  protected maxRenewals: number | null = null;

  ngOnInit() { this.load(); }

  protected load() {
    this.loading.set(true);
    this.error.set('');
    this.api.types(this.context.company.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: types => { this.types.set(types); this.loading.set(false); },
      error: error => { this.error.set(contractErrorMessage(error)); this.loading.set(false); },
    });
  }

  protected create() {
    if (this.saving()) return;
    const code = this.code.trim();
    const name = this.name.trim();
    if (!/^[A-Za-z0-9_-]{1,50}$/.test(code) || !name
        || (this.maxRenewals !== null && (!Number.isInteger(this.maxRenewals) || this.maxRenewals < 0))) {
      this.error.set($localize`:@@contracts-enter-a-valid-code-name-and-renewal-limit:Enter a valid code, name and renewal limit.`);
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.notice.set('');
    const input = {
      code, name, legalRuleVersionId: this.ruleVersion.trim() || null,
      requiresEndDate: this.requiresEndDate, maxRenewals: this.maxRenewals, active: true,
    };
    this.api.createType(this.context.company.id, input).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.showForm.set(false);
        this.saving.set(false);
        this.notice.set($localize`:@@contracts-contract-type-created:Contract type created.`);
        this.code = '';
        this.name = '';
        this.ruleVersion = '';
        this.requiresEndDate = true;
        this.maxRenewals = null;
        this.load();
      },
      error: error => { this.error.set(contractErrorMessage(error)); this.saving.set(false); },
    });
  }
}
