import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { SupportCompany, SupportPage } from '../domain/support.models';
import { SupportApi } from '../infrastructure/support-api.service';

@Component({
  selector: 'app-support-company-picker',
  standalone: true,
  imports: [FormsModule, ComponentCardComponent],
  styleUrl: './support.css',
  template: `
    <app-component-card title="Company scope">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="sup-muted">{{ company ? company.name + ' · #' + company.id : 'Select the company whose shared requests you want to manage.' }}</p>
        <button class="sup-secondary" type="button" [disabled]="disabled" [attr.aria-expanded]="open()" (click)="toggle()">{{ company ? 'Change company' : 'Choose company' }}</button>
      </div>
      @if (open()) {
        <form class="mt-3 flex flex-wrap items-end gap-2" (ngSubmit)="load(1, true)">
          <label class="sup-label min-w-44 flex-1">Company name or ID
            <input class="sup-input" name="companySearch" maxlength="100" [(ngModel)]="search">
          </label>
          <button class="sup-secondary" type="submit" [disabled]="busy()">Search</button>
        </form>
        @if (error()) { <p class="sup-error mt-3" role="alert">{{ error() }}</p> }
        @else if (busy()) { <p class="sup-muted mt-3" role="status">Loading companies…</p> }
        @else if (result(); as page) {
          <ul class="mt-3 max-h-56 divide-y divide-gray-100 overflow-auto dark:divide-gray-800">
            @for (item of page.data; track item.id) {
              <li><button type="button" class="w-full rounded-lg px-2 py-2 text-start text-sm text-gray-800 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-gray-800" [disabled]="disabled" (click)="select(item)">
                {{ item.name }} <span class="sup-muted">#{{ item.id }}</span>
              </button></li>
            } @empty { <li class="sup-muted py-3">No matching companies.</li> }
          </ul>
          @if (page.total > page.limit) {
            <div class="mt-3 flex gap-2">
              <button type="button" class="sup-secondary" [disabled]="page.page === 1" (click)="load(page.page - 1)">Previous</button>
              <button type="button" class="sup-secondary" [disabled]="page.page * page.limit >= page.total" (click)="load(page.page + 1)">Next</button>
            </div>
          }
        }
      }
    </app-component-card>
  `,
})
export class SupportCompanyPickerComponent {
  private readonly api = inject(SupportApi);
  @Input() company: SupportCompany | null = null;
  @Input() disabled = false;
  @Output() chosen = new EventEmitter<SupportCompany>();
  protected readonly open = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly result = signal<SupportPage<SupportCompany> | null>(null);
  protected search = '';
  private appliedSearch = '';

  protected toggle() {
    this.open.update(value => !value);
    if (this.open() && !this.result()) void this.load();
  }
  protected select(company: SupportCompany) {
    this.open.set(false);
    this.chosen.emit(company);
  }
  protected async load(page = 1, search = false) {
    if (this.busy()) return;
    if (search) this.appliedSearch = this.search.trim();
    this.busy.set(true);
    this.error.set('');
    try { this.result.set(await firstValueFrom(this.api.companies(this.appliedSearch, page))); }
    catch (error) { this.error.set(apiErrorMessage(error)); }
    finally { this.busy.set(false); }
  }
}
