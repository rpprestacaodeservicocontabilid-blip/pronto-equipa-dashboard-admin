import { Component, Input, inject, signal } from '@angular/core';
import { CompanyWorkspace } from '../../../core/api/company-workspace-api';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { cents, human, money } from '../domain/salary-format';
import { Simulation } from '../domain/salary.models';
import { SalaryApi } from '../infrastructure/salary-api.service';
import { SalaryFormComponent } from './salary-form.component';
import { SalaryForm, effectiveFrom, string } from './salary-form';
import { overrideFields, payFields, payInput } from './salary-pay-forms';

@Component({
  selector: 'app-salary-simulation',
  standalone: true,
  imports: [ComponentCardComponent, SalaryFormComponent],
  template: `
    @if (form(); as editor) {
      @for (task of [editor]; track task) {
        <app-salary-form [context]="context" [definition]="task" (cancelled)="form.set(null)" (completed)="simulated($event)" />
      }
    } @else {
      <button type="button" class="action action-primary" [disabled]="results().length >= 2" (click)="add()">New simulation</button>
      @if (results().length) { <button type="button" class="action" (click)="results.set([])">Clear comparison</button> }
    }
    <div class="grid gap-4 xl:grid-cols-2">
      @for (item of results(); track $index) {
        <app-component-card [title]="'Scenario ' + ($index + 1)" [desc]="'Effective on ' + item.effectiveDate">
          <dl class="grid gap-4 text-sm text-gray-700 sm:grid-cols-2 dark:text-gray-300">
            <div><dt>Base salary</dt><dd class="font-semibold">{{ money(item.baseSalary, item.currency) }}</dd></div>
            <div><dt>Projected recurring monthly pay</dt><dd class="font-semibold">{{ money(item.totalRecurring, item.currency) }}</dd></div>
          </dl>
          <ul class="divide-y divide-gray-100 text-sm text-gray-700 dark:divide-gray-800 dark:text-gray-300">
            @for (part of item.components; track part.componentVersionId) {
              <li class="flex flex-wrap justify-between gap-2 py-2"><span>{{ part.code }} · {{ human(part.frequency ?? '') }}</span>
                <strong>{{ money(part.amount, part.currency ?? item.currency) }}</strong></li>
            } @empty { <li>No additional components.</li> }
          </ul>
          <p class="text-sm text-gray-600 dark:text-gray-400">Gross projection before taxes and contributions.</p>
        </app-component-card>
      }
    </div>
    @if (results().length === 2) {
      <p class="notice" role="status">Change in projected recurring pay · {{ difference() }}</p>
    }
  `,
})
export class SalarySimulationComponent {
  @Input({ required: true }) context!: CompanyWorkspace;
  private readonly api = inject(SalaryApi);
  protected readonly form = signal<SalaryForm | null>(null);
  protected readonly results = signal<Simulation[]>([]);
  protected readonly money = money;
  protected readonly human = human;
  protected add() {
    this.form.set({
      title: 'Simulate pay', description: 'Use a published structure or enter individual component versions.',
      fields: [effectiveFrom(), ...payFields(undefined, false)], group: { title: 'Component overrides or additions', fields: overrideFields },
      submitLabel: 'Run simulation',
      send: (values, rows) => {
        const pay = payInput(values, rows);
        return this.api.simulate(this.context.company.id, { ...pay, structureVersionId: pay.structureVersionId || undefined,
          effectiveDate: string(values, 'effectiveFrom') });
      },
    });
  }
  protected simulated(result: unknown) { this.results.update(previous => [...previous, result as Simulation]); this.form.set(null); }
  protected difference() {
    const [first, second] = this.results();
    const a = cents(first.totalRecurring);
    const b = cents(second.totalRecurring);
    return a === null || b === null || first.currency !== second.currency ? 'Compare scenarios in the same currency.' : money(b - a, first.currency);
  }
}
