import { Component, DestroyRef, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { organizationErrorMessage } from './organization-display';
import { OrganizationRecord } from '../domain/organization.models';
import { OrganizationApi } from '../infrastructure/organization-api.service';

@Component({
  selector: 'app-organization-filter',
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (error()) { <p class="text-sm text-gray-600 dark:text-gray-400" role="status">{{ error() }}</p> }
    @if (data(); as directory) {
      @if (directory.departments.length || directory.establishments.length) {
        <div class="grid gap-3 sm:grid-cols-2">
          @if (directory.establishments.length) {
            <label class="field"><ng-container i18n="@@organization-establishment">Establishment</ng-container>
              <select class="control" [disabled]="disabled" [ngModel]="establishment" [ngModelOptions]="{standalone: true}" (ngModelChange)="selectEstablishment($event)">
                <option value=""><ng-container i18n="@@organization-all-establishments">All establishments</ng-container></option>
                @for (item of directory.establishments; track item.id) { <option [value]="item.id">{{ item.name }}</option> }
              </select>
            </label>
          }
          @if (departments().length) {
            <label class="field"><ng-container i18n="@@organization-department">Department</ng-container>
              <select class="control" [disabled]="disabled" [ngModel]="department" [ngModelOptions]="{standalone: true}" (ngModelChange)="department = $event; select()">
                <option value=""><ng-container i18n="@@organization-all-departments">All departments</ng-container></option>
                @for (item of departments(); track item.id) { <option [value]="item.id">{{ item.name }}</option> }
              </select>
            </label>
          }
        </div>
      }
    }
  `,
})
export class OrganizationFilterComponent implements OnInit {
  @Input({ required: true }) company!: number;
  @Input() disabled = false;
  @Output() readonly scopeChange = new EventEmitter<string[] | null>();
  private readonly api = inject(OrganizationApi);
  private readonly destroy = inject(DestroyRef);
  protected readonly data = signal<{ departments: OrganizationRecord[]; establishments: OrganizationRecord[] } | null>(null);
  protected readonly error = signal('');
  protected establishment = '';
  protected department = '';

  ngOnInit() {
    forkJoin({ departments: this.api.all(this.company, 'departments'), establishments: this.api.all(this.company, 'establishments') })
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: result => this.data.set(result),
        error: error => this.error.set($localize`:@@organization-organization-filters-are-unavailable:Organization filters are unavailable.` + " " + organizationErrorMessage(error)),
      });
  }

  protected departments() {
    return this.data()?.departments.filter(row => !this.establishment || row.data['establishmentId'] === this.establishment) ?? [];
  }
  protected selectEstablishment(id: string) {
    this.establishment = id;
    this.department = '';
    this.select();
  }
  protected select() {
    this.scopeChange.emit(this.department ? [this.department] : this.establishment ? this.departments().map(row => row.id) : null);
  }
}
