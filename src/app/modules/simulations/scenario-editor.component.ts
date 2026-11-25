import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Adjustment, Scenario, ScenarioDraft } from './simulations.models';
import { creatableTypes, ScenarioType, scenarioTypes } from './simulations.navigation';

export const uuidPattern = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
export const decimal = (value: string, digits: number) => {
  const [whole, fraction = ''] = value.trim().split('.');
  return new RegExp('^\\d{1,' + digits + '}(\\.\\d{1,2})?$').test(value.trim())
    ? whole + '.' + fraction.padEnd(2, '0') : null;
};
const employeeIds = (value: string) => [...new Set(value.trim().toLowerCase().split(/[\s,]+/).filter(Boolean))];

@Component({
  selector: 'app-scenario-editor',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './scenario-editor.component.html',
  styleUrl: './simulations.css',
})
export class ScenarioEditorComponent implements OnChanges {
  @Input() scenario: Scenario | null = null;
  @Input() initialType: ScenarioType = 'CUSTOM';
  @Input() busy = false;
  @Output() save = new EventEmitter<ScenarioDraft>();
  @Output() dismiss = new EventEmitter<void>();

  protected readonly labels = scenarioTypes;
  protected readonly types = creatableTypes;
  protected readonly operations: Adjustment['operation'][] = ['SET', 'ADD', 'SUBTRACT', 'PERCENT_INCREASE', 'PERCENT_DECREASE'];
  protected draft!: ScenarioDraft;
  protected selection = 'employees';
  protected employees = '';
  protected exclusions = '';
  protected error = '';

  ngOnChanges() {
    if (this.draft) return;
    this.draft = this.scenario ? structuredClone(this.scenario) : {
      name: '', type: this.initialType, configuration: { period: { startDate: '', endDate: '' }, adjustments: [] },
    };
    const config = this.draft.configuration;
    this.selection = this.scenario && !config.employeeIds?.length ? 'company' : 'employees';
    this.employees = config.employeeIds?.join(', ') ?? '';
    this.exclusions = config.excludeEmployeeIds?.join(', ') ?? '';
  }

  protected addAdjustment() {
    this.draft.configuration.adjustments.push({ componentCode: '', operation: 'SET', value: '' });
  }

  protected submit() {
    this.error = '';
    const { name, type, configuration } = this.draft;
    const { period, departmentId, jobCategory, baselinePayrollRunId } = configuration;
    const included = this.selection === 'employees' || type === 'INDIVIDUAL_PAYROLL' ? employeeIds(this.employees) : [];
    const excluded = employeeIds(this.exclusions);
    if (name.trim().length < 2 || !period.startDate || !period.endDate || period.startDate > period.endDate) {
      this.error = 'Enter a scenario name and a valid period.';
      return;
    }
    if ((type === 'INDIVIDUAL_PAYROLL' && included.length !== 1)
      || (this.selection === 'employees' && !included.length)
      || included.length > 500 || excluded.length > 500
      || [...included, ...excluded].some(id => !uuidPattern.test(id))
      || included.some(id => excluded.includes(id))) {
      this.error = 'Enter valid worker IDs for the chosen scope. An individual scenario requires exactly one worker.';
      return;
    }
    if ((departmentId != null && (!Number.isInteger(departmentId) || departmentId < 1))
      || (baselinePayrollRunId && !uuidPattern.test(baselinePayrollRunId))) {
      this.error = 'Check the department and baseline payroll identifiers.';
      return;
    }

    const adjustments: Adjustment[] = [];
    for (const adjustment of configuration.adjustments) {
      const componentCode = adjustment.componentCode.trim().toUpperCase();
      const value = decimal(adjustment.value, 12);
      const employeeId = adjustment.employeeId?.trim() || undefined;
      const effectiveFrom = adjustment.effectiveFrom || undefined;
      const effectiveTo = adjustment.effectiveTo || undefined;
      if (!/^[A-Z0-9_:-]{2,80}$/.test(componentCode) || value === null ||
        (employeeId && !uuidPattern.test(employeeId)) || (effectiveFrom && effectiveTo && effectiveFrom > effectiveTo)) {
        this.error = 'Check each component code, amount or percentage, worker ID and effective dates.';
        return;
      }
      adjustments.push({ componentCode, value, operation: adjustment.operation, employeeId, effectiveFrom, effectiveTo });
    }

    this.save.emit({ name: name.trim(), type, configuration: {
      ...configuration, period, adjustments,
      employeeIds: included.length ? included : undefined,
      excludeEmployeeIds: excluded.length ? excluded : undefined,
      departmentId: departmentId ?? undefined, jobCategory: jobCategory?.trim() || undefined,
      baselinePayrollRunId: baselinePayrollRunId || undefined,
    } });
  }
}
