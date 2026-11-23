import { Component, DestroyRef, Input, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { payrollMoney } from '../../payroll/domain/payroll-format';
import { EngineScenario, EngineSimulation, normalizeScenario, ROUNDING_MODES, SAMPLE_SCENARIO } from '../domain/engine.models';
import { PayrollEngineApi } from '../infrastructure/payroll-engine-api.service';
import { EngineEvidenceComponent } from './engine-evidence.component';

@Component({
  selector: 'app-engine-simulation',
  standalone: true,
  imports: [FormsModule, ComponentCardComponent, EngineEvidenceComponent],
  templateUrl: './engine-simulation.component.html',
})
export class EngineSimulationComponent {
  @Input({ required: true }) companyId!: number;
  private readonly api = inject(PayrollEngineApi);
  private readonly destroy = inject(DestroyRef);
  protected readonly money = payrollMoney;
  protected readonly modes = ROUNDING_MODES;
  protected readonly working = signal(false);
  protected readonly error = signal('');
  protected readonly result = signal<EngineSimulation | null>(null);
  protected scenario: EngineScenario = { ...SAMPLE_SCENARIO };

  protected change<K extends keyof EngineScenario>(field: K, value: EngineScenario[K]) {
    this.scenario[field] = value;
    this.result.set(null);
    this.error.set('');
  }

  protected reset() {
    this.scenario = { ...SAMPLE_SCENARIO };
    this.result.set(null);
    this.error.set('');
  }

  protected run() {
    if (this.working()) return;
    const scenario = normalizeScenario(this.scenario);
    if (!scenario) {
      this.error.set('Enter a month between 2000 and 2099 and non-negative decimal amounts with up to six decimal places.');
      return;
    }
    this.error.set('');
    this.result.set(null);
    this.working.set(true);
    this.api.simulate(this.companyId, scenario).pipe(
      takeUntilDestroyed(this.destroy), finalize(() => this.working.set(false)),
    ).subscribe({
      next: result => this.result.set(result),
      error: error => this.error.set(apiErrorMessage(error)),
    });
  }
}
