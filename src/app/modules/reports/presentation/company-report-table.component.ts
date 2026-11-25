import { Component, Input } from '@angular/core';
import { DataRow, fieldLabel } from '../domain/company-reports.models';

@Component({
  selector: 'app-company-report-table',
  standalone: true,
  styleUrl: './platform-reports.css',
  template: `
    <div class="overflow-x-auto">
      @if (columns.length) {
        <table class="pr-table w-full">
          <thead><tr>
            @for (field of columns; track field) {
              <th scope="col" [attr.aria-sort]="sortKey === field ? (direction === 1 ? 'ascending' : 'descending') : 'none'">
                <button type="button" class="pr-link" (click)="sort(field)">{{ fieldLabel(field) }}
                  @if (sortKey === field) { <span aria-hidden="true">{{ direction === 1 ? '↑' : '↓' }}</span> }
                </button>
              </th>
            }
          </tr></thead>
          <tbody>
            @for (row of visible; track $index) {
              <tr>@for (field of columns; track field) { <td class="max-w-80 break-words">{{ cell(row[field]) }}</td> }</tr>
            }
          </tbody>
        </table>
      } @else { <p class="pr-muted">No records for these filters.</p> }
    </div>
    @if (data.length > limit) {
      <div class="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p class="pr-muted" aria-live="polite">{{ data.length }} rows · Page {{ page }}</p>
        <div class="flex gap-2">
          <button class="pr-secondary" type="button" [disabled]="page === 1" (click)="show(page - 1)">Previous</button>
          <button class="pr-secondary" type="button" [disabled]="page * limit >= data.length" (click)="show(page + 1)">Next</button>
        </div>
      </div>
    }
  `,
})
export class CompanyReportTableComponent {
  private readonly collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  protected readonly fieldLabel = fieldLabel;
  protected readonly limit = 25;
  protected columns: string[] = [];
  protected data: DataRow[] = [];
  protected visible: DataRow[] = [];
  protected page = 1;
  protected sortKey = '';
  protected direction = 1;

  @Input() set rows(rows: DataRow[]) {
    this.data = [...rows];
    this.columns = [...new Set(rows.flatMap(row => Object.keys(row)))];
    this.sortKey = '';
    this.direction = 1;
    this.show(1);
  }

  protected show(page: number) {
    this.page = page;
    this.visible = this.data.slice((page - 1) * this.limit, page * this.limit);
  }

  protected sort(field: string) {
    this.direction = this.sortKey === field ? -this.direction : 1;
    this.sortKey = field;
    this.data.sort((a, b) => {
      const left = a[field], right = b[field];
      if (left == null || right == null) return Number(left == null) - Number(right == null);
      const l = this.cell(left), r = this.cell(right);
      const numeric = /^-?\\d+(?:\\.\\d+)?$/;
      return this.direction * (numeric.test(l) && numeric.test(r) ? Number(l) - Number(r) : this.collator.compare(l, r));
    });
    this.show(1);
  }
  protected cell(value: unknown) {
    if (value == null) return '—';
    return typeof value === 'object' ? JSON.stringify(value) : String(value);
  }
}
