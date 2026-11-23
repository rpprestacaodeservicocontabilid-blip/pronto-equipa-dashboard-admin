import { Component, Input } from '@angular/core';
import { money } from '../domain/loans-format';
import { Simulation } from '../domain/loans.models';

@Component({
  selector: 'app-loan-simulation',
  standalone: true,
  imports: [],
  template: `
    <div class="space-y-3">
      <p class="text-sm text-gray-700 dark:text-gray-300">Projected total <strong>{{ money(simulation.totalAmount) }}</strong> · Policy version {{ simulation.policyVersion }}</p>
      <div class="max-h-80 overflow-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table class="w-full min-w-96 text-sm text-gray-700 dark:text-gray-300">
          <thead class="table-heading"><tr><th scope="col">No.</th><th scope="col">Due</th><th scope="col">Principal</th><th scope="col">Interest</th><th scope="col">Total</th></tr></thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
            @for (item of simulation.installments; track item.number) {
              <tr><td class="table-cell">{{ item.number }}</td><td class="table-cell">{{ item.dueDate }}</td>
                <td class="table-cell">{{ money(item.principalDue) }}</td><td class="table-cell">{{ money(item.interestDue) }}</td>
                <td class="table-cell">{{ money(item.totalDue) }}</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class LoanSimulationComponent {
  @Input({ required: true }) simulation!: Simulation;
  protected readonly money = money;
}
