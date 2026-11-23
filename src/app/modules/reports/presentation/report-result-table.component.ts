import { DecimalPipe } from '@angular/common';
import { Component, Input } from '@angular/core';
import { label, Observation } from '../domain/platform-reports.models';

@Component({
  selector: 'app-report-result-table',
  standalone: true,
  imports: [DecimalPipe],
  styleUrl: './platform-reports.css',
  template: `
    <div class="overflow-x-auto">
      <table class="pr-table w-full">
        <thead><tr><th scope="col">Period</th><th scope="col">Category</th><th scope="col">State</th><th scope="col">Count</th></tr></thead>
        <tbody>
          @for (row of rows.slice((page - 1) * limit, page * limit); track row.period + '/' + row.category + '/' + row.state) {
            <tr><td>{{ row.period }}</td><td>{{ label(row.category) }}</td><td><span class="pr-badge" [attr.data-status]="row.state">{{ label(row.state) }}</span></td><td>{{ row.count | number }}</td></tr>
          } @empty { <tr><td colspan="4">No activity for this scope.</td></tr> }
        </tbody>
      </table>
    </div>
    @if (rows.length > limit) {
      <div class="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p class="pr-muted" aria-live="polite">{{ rows.length | number }} groups · Page {{ page }}</p>
        <div class="flex gap-2">
          <button type="button" class="pr-secondary" [disabled]="page <= 1" (click)="page = page - 1">Previous</button>
          <button type="button" class="pr-secondary" [disabled]="page * limit >= rows.length" (click)="page = page + 1">Next</button>
        </div>
      </div>
    }
  `,
})
export class ReportResultTableComponent {
  @Input() set observations(rows: Observation[]) { this.rows = rows; this.page = 1; }
  protected rows: Observation[] = [];
  protected page = 1;
  protected readonly limit = 20;
  protected readonly label = label;
}
