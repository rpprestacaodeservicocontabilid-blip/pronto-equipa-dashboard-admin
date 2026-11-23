import { Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { CompanyWorkspace } from '../../../core/api/company-workspace-api';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { payrollDate, payrollLabel } from '../domain/payroll-format';
import { POLICIES_MANAGE } from '../domain/payroll-sections';
import { PayrollApi } from '../infrastructure/payroll-api.service';
import { payrollQuery } from './payroll-ui';

@Component({
  selector: 'app-payroll-settings', standalone: true,
  imports: [FormsModule, ComponentCardComponent], templateUrl: './payroll-settings.component.html',
})
export class PayrollSettingsComponent {
  readonly context = input.required<CompanyWorkspace>();
  private readonly api = inject(PayrollApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly refreshCount = signal(0);
  protected readonly date = payrollDate;
  protected readonly label = payrollLabel;
  protected readonly failure = signal('');
  protected readonly notice = signal('');
  protected readonly busy = signal(false);
  protected readonly editing = signal(false);
  protected code = '';
  protected requiredApprovals: number | null = 1;
  protected readonly policies = payrollQuery(computed(() => {
    this.refreshCount();
    return this.context().company.id;
  }), company => this.api.policies(company));

  protected refresh() { this.refreshCount.update(value => value + 1); }

  protected save() {
    if (this.busy() || !this.context().permissions.includes(POLICIES_MANAGE)) return;
    const count = this.requiredApprovals;
    const code = this.code.trim();
    if (!code || count == null || !Number.isInteger(count) || count < 1 || count > 5) {
      this.failure.set('Enter a policy code and select one to five distinct approvals.');
      return;
    }
    this.busy.set(true);
    this.failure.set('');
    this.notice.set('');
    this.api.createPolicy(this.context().company.id, code, count).pipe(
      takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false)),
    ).subscribe({
      next: () => {
        this.editing.set(false);
        this.notice.set('Approval policy published.');
        this.code = '';
        this.requiredApprovals = 1;
        this.refresh();
      },
      error: error => this.failure.set(apiErrorMessage(error)),
    });
  }
}
