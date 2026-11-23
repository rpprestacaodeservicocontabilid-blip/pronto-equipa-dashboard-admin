import { Component, DestroyRef, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { defer } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { CompanyWorkspace } from '../../../core/api/company-workspace-api';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { SalaryFieldComponent } from './salary-field.component';
import { SalaryForm, Values, initialValues, string, validate } from './salary-form';

@Component({
  selector: 'app-salary-form',
  standalone: true,
  imports: [FormsModule, ComponentCardComponent, SalaryFieldComponent],
  templateUrl: './salary-form.component.html',
})
export class SalaryFormComponent implements OnInit {
  @Input({ required: true }) context!: CompanyWorkspace;
  @Input({ required: true }) definition!: SalaryForm;
  @Output() readonly completed = new EventEmitter<unknown>();
  @Output() readonly cancelled = new EventEmitter<void>();
  private readonly destroy = inject(DestroyRef);
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly confirmed = signal(false);
  protected readonly string = string;
  protected values: Values = {};
  protected rows: Values[] = [];

  ngOnInit() {
    this.values = initialValues(this.definition.fields);
    const group = this.definition.group;
    if (group?.rows?.length) this.rows = group.rows.map(row => ({ ...row }));
    else if (group?.min) this.rows = Array.from({ length: group.min }, () => initialValues(group.fields));
  }

  protected add() {
    const group = this.definition.group!;
    if (this.rows.length < (group.max ?? 100)) this.rows = [...this.rows, initialValues(group.fields)];
  }

  protected remove(index: number) { this.rows = this.rows.filter((_, row) => row !== index); }

  protected submit() {
    if (this.busy() || (this.definition.confirm && !this.confirmed())) return;
    this.error.set('');
    this.busy.set(true);
    defer(() => {
      validate(this.definition.fields, this.values);
      const group = this.definition.group;
      if (group && this.rows.length < (group.min ?? 0)) throw new Error('Add the required entries.');
      if (group) this.rows.forEach((row, index) => {
        try { validate(group.fields, row); } catch (error) { throw new Error('Entry ' + (index + 1) + ' · ' + apiErrorMessage(error)); }
      });
      return this.definition.send(this.values, this.rows);
    }).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: result => { this.busy.set(false); this.completed.emit(result); },
      error: error => { this.busy.set(false); this.error.set(apiErrorMessage(error)); },
    });
  }
}
