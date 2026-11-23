import { Component, Input } from '@angular/core';
import { label, money, today } from '../domain/loans-format';
import { Installment } from '../domain/loans.models';

@Component({
  selector: 'app-loan-installments',
  standalone: true,
  imports: [],
  template: `
    <div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
      <table class="w-full min-w-[38rem] text-start text-sm text-gray-700 dark:text-gray-300">
        <thead class="table-heading"><tr>
          <th scope="col">No.</th><th scope="col">Due date</th><th scope="col">Principal due</th><th scope="col">Interest due</th>
          @if (showPaid) { <th scope="col">Confirmed paid</th> }<th scope="col">Status</th>
        </tr></thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
          @for (item of installments; track item.id) {
            <tr><td class="table-cell">{{ item.installmentNumber }}</td><td class="table-cell whitespace-nowrap">{{ item.dueDate }}</td>
              <td class="table-cell">{{ money(item.principalDue, currency) }}</td><td class="table-cell">{{ money(item.interestDue, currency) }}</td>
              @if (showPaid) { <td class="table-cell">{{ money(item.paid?.total, currency) }}</td> }
              <td class="table-cell">
                {{ label(item.status) }}
                @if (showPaid && item.dueDate < today && (item.status === 'PENDING' || item.status === 'PARTIALLY_PAID')) {
                  <span class="block text-error-700 dark:text-error-400">Overdue</span>
                }
              </td>
            </tr>
          } @empty { <tr><td class="table-cell" [attr.colspan]="showPaid ? 6 : 5">No installments.</td></tr> }
        </tbody>
      </table>
    </div>
  `,
})
export class LoanInstallmentsComponent {
  @Input({ required: true }) installments!: Installment[];
  @Input() currency = 'AOA';
  @Input() showPaid = false;
  protected readonly label = label;
  protected readonly money = money;
  protected readonly today = today();
}
