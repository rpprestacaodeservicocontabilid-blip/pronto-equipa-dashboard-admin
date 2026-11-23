import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { Company } from '../domain/platform-reports.models';
import { PlatformReportsApi } from '../infrastructure/platform-reports-api';

@Component({
  selector: 'app-report-company-picker',
  standalone: true,
  imports: [FormsModule],
  styleUrl: './platform-reports.css',
  template: `
    <label class="pr-label">Company
      <select class="pr-input" [disabled]="disabled" [ngModel]="companyId" [ngModelOptions]="{standalone: true}" (ngModelChange)="select($event)">
        <option [ngValue]="undefined">All companies</option>
        @if (companyId && !hasCompany()) { <option [ngValue]="companyId">{{ selected?.name || 'Company #' + companyId }}</option> }
        @for (company of companies(); track company.id) { <option [ngValue]="company.id">{{ company.name }}</option> }
      </select>
    </label>
    @if (!disabled) {
      <details class="mt-2">
        <summary class="pr-link cursor-pointer text-xs">Find a company</summary>
        <div class="mt-2 flex flex-wrap items-end gap-2">
          <label class="pr-label grow">Name<input class="pr-input" type="search" maxlength="100" [ngModelOptions]="{standalone: true}" [(ngModel)]="search"></label>
          <button type="button" class="pr-secondary" [disabled]="busy()" (click)="load(1, true)">Search</button>
          @if (page() > 1) { <button type="button" class="pr-secondary" [disabled]="busy()" (click)="load(page() - 1)">Previous</button> }
          @if (page() * 50 < total()) { <button type="button" class="pr-secondary" [disabled]="busy()" (click)="load(page() + 1)">More</button> }
        </div>
        <p class="pr-muted mt-2">{{ total() }} companies match the search. Select a company from the list above.</p>
      </details>
    }
    @if (error()) { <p class="pr-error mt-2" role="alert">{{ error() }}</p> }
  `,
})
export class ReportCompanyPickerComponent {
  private readonly api = inject(PlatformReportsApi);
  @Input() companyId?: number;
  @Input() disabled = false;
  @Output() companyIdChange = new EventEmitter<number | undefined>();
  protected readonly companies = signal<Company[]>([]);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected search = '';
  protected selected?: Company;
  private applied = '';

  constructor() { void this.load(1); }

  protected hasCompany() { return this.companies().some(company => company.id === this.companyId); }
  protected select(id?: number) {
    this.selected = this.companies().find(company => company.id === id) ?? (this.selected?.id === id ? this.selected : undefined);
    this.companyIdChange.emit(id);
  }
  protected async load(page: number, search = false) {
    if (this.busy()) return;
    if (search) this.applied = this.search.trim();
    this.busy.set(true);
    this.error.set('');
    try {
      const { items, total } = await firstValueFrom(this.api.companies(this.applied, page));
      this.companies.set(items);
      this.total.set(total);
      this.page.set(page);
    } catch (error) { this.error.set(apiErrorMessage(error)); }
    finally { this.busy.set(false); }
  }
}
