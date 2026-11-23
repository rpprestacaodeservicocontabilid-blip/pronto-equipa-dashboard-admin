import { Component, computed, Input, signal } from '@angular/core';
import { payrollLabel, payrollMoney } from '../../payroll/domain/payroll-format';
import { EngineEvidence, ROUNDING_MODES } from '../domain/engine.models';

@Component({
  selector: 'app-engine-evidence',
  standalone: true,
  templateUrl: './engine-evidence.component.html',
})
export class EngineEvidenceComponent {
  private readonly value = signal<EngineEvidence | null>(null);
  @Input({ alias: 'evidence', required: true }) set evidenceValue(value: EngineEvidence) {
    this.value.set(value);
  }
  protected readonly evidence = this.value.asReadonly();
  protected readonly money = payrollMoney;
  protected readonly label = payrollLabel;
  protected readonly rounding = computed(() => {
    const policy = this.evidence()?.trace.roundingPolicy;
    if (!policy) return '';
    return ROUNDING_MODES.find(mode => mode.id === policy.mode)?.label ?? policy.mode;
  });
}
