import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Segment } from '../../domain/leave.models';

@Component({
  selector: 'app-leave-periods',
  standalone: true,
  imports: [FormsModule],
  template: `
    <fieldset class="space-y-3">
      <legend class="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Leave periods</legend>
      @for (period of periods; track $index; let index = $index) {
        <div class="grid items-end gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <label class="field">Start date
            <input class="control" type="date" [ngModel]="period.startDate" [ngModelOptions]="{standalone: true}"
              (ngModelChange)="replace(index, 'startDate', $event)" [attr.min]="minimum || null" [attr.max]="maximum || null" />
          </label>
          <label class="field">End date
            <input class="control" type="date" [ngModel]="period.endDate" [ngModelOptions]="{standalone: true}"
              (ngModelChange)="replace(index, 'endDate', $event)" [attr.min]="period.startDate || minimum || null" [attr.max]="maximum || null" />
          </label>
          <button class="action" type="button" (click)="remove(index)" [disabled]="periods.length < 2">Remove period</button>
        </div>
      }
      <button class="action" type="button" [disabled]="periods.length >= 20" (click)="add()">Add period</button>
    </fieldset>
  `,
})
export class LeavePeriodsComponent {
  @Input({ required: true }) periods!: Segment[];
  @Input() minimum = '';
  @Input() maximum = '';
  @Output() periodsChange = new EventEmitter<Segment[]>();

  protected replace(index: number, key: keyof Segment, value: string) {
    this.periodsChange.emit(this.periods.map((period, position) => index === position ? { ...period, [key]: value } : period));
  }
  protected remove(index: number) { this.periodsChange.emit(this.periods.filter((_, position) => index !== position)); }
  protected add() { this.periodsChange.emit([...this.periods, { startDate: '', endDate: '' }]); }
}
