import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject, catchError, debounceTime, map, of, startWith, switchMap } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { Employee } from '../domain/loans.models';
import { LoansApi } from '../infrastructure/loans-api.service';

@Component({
  selector: 'app-loan-employee-picker',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="space-y-3">
      @if (canSearch) {
        <label class="field">Find an employee
          <input class="control" type="search" [disabled]="disabled" placeholder="Name or employee number" maxlength="100"
            [ngModel]="search()" (ngModelChange)="lookup($event)" />
        </label>
        @if (results(); as state) {
          @if ('error' in state) { <p class="feedback" role="alert">{{ state.error }}</p> }
          @if ('loading' in state) { <p role="status" class="text-sm text-gray-600 dark:text-gray-400">Searching employees…</p> }
          @if ('rows' in state && state.rows.length) {
            <ul aria-label="Employees found" class="max-h-48 space-y-1 overflow-auto">
              @for (person of state.rows; track person.id) {
                <li><button type="button" class="action w-full justify-start" [disabled]="disabled" (click)="choose(person)">
                  {{ person.firstName }} {{ person.lastName }} · {{ person.employeeNumber }}
                </button></li>
              }
            </ul>
          } @else if ('rows' in state) { <p class="text-sm text-gray-600 dark:text-gray-400">No employees found.</p> }
        }
      }
      <label class="field">Employee ID
        <input class="control" maxlength="36" [disabled]="disabled" [ngModel]="value" (ngModelChange)="employeeChange.emit($event.trim())" />
      </label>
    </div>
  `,
})
export class LoanEmployeePickerComponent {
  @Input({ required: true }) company!: number;
  @Input() canSearch = false;
  @Input() value = '';
  @Input() disabled = false;
  @Output() readonly employeeChange = new EventEmitter<string>();
  private readonly api = inject(LoansApi);
  private readonly query = new Subject<string>();
  protected readonly search = signal('');
  protected readonly results = toSignal(this.query.pipe(
    debounceTime(220),
    switchMap(text => text.length < 2 ? of(null) : this.api.employees(this.company, text).pipe(
      map(rows => ({ rows })),
      catchError(error => of({ error: apiErrorMessage(error) })),
      startWith({ loading: true }),
    )),
  ));

  protected lookup(text: string) { this.search.set(text); this.query.next(text.trim()); }
  protected choose(employee: Employee) { this.employeeChange.emit(employee.id); this.lookup(''); }
}
