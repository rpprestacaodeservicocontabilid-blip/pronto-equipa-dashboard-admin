import { KeyValuePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { apiErrorMessage } from '../../core/api/api-error';
import { ComponentCardComponent } from '../../shared/components/common/component-card/component-card.component';
import { PageBreadcrumbComponent } from '../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { DocumentsApi, Oversight } from './documents-api.service';

@Component({
  standalone: true, imports: [FormsModule, KeyValuePipe, RouterLink, ComponentCardComponent, PageBreadcrumbComponent],
  styleUrl: './documents.css',
  template: `
    <app-page-breadcrumb pageTitle="Document oversight" />
    <div class="space-y-5">
      <app-component-card title="Company document indicators">
        <form class="flex flex-wrap items-end gap-3" #scope="ngForm" (ngSubmit)="scope.valid && load()">
          <label class="doc-label">Company ID<input class="doc-input" name="company" type="number" required min="1" max="2147483647" [(ngModel)]="company"></label>
          <button type="submit" class="doc-primary" [disabled]="scope.invalid || busy()">View indicators</button>
          <a routerLink="/documents" class="doc-link self-center">Open company document workspace</a>
        </form>
      </app-component-card>
      @if (busy()) { <p class="doc-muted" role="status">Loading indicators…</p> }
      @if (error()) { <p class="doc-error" role="alert">{{ error() }}</p> }
      @if (result(); as summary) {
        <app-component-card [title]="summary.company.name">
          <dl class="grid gap-4 sm:grid-cols-3">
            @for (row of summary.byStatus | keyvalue; track row.key) {
              <div><dt class="doc-label">{{ row.key.replaceAll('_', ' ') }}</dt><dd class="doc-muted">{{ row.value }}</dd></div>
            } @empty { <p class="doc-muted">No document records.</p> }
          </dl>
          @if (summary.storage; as storage) {
            <dl class="mt-5 grid gap-4 border-t border-gray-200 pt-4 sm:grid-cols-3 dark:border-gray-800">
              <div><dt class="doc-label">Used storage</dt><dd class="doc-muted">{{ storage.usedBytes }} bytes</dd></div>
              <div><dt class="doc-label">Reserved storage</dt><dd class="doc-muted">{{ storage.reservedBytes }} bytes</dd></div>
              <div><dt class="doc-label">Storage quota</dt><dd class="doc-muted">{{ storage.quotaBytes }} bytes</dd></div>
            </dl>
          }
        </app-component-card>
      }
    </div>
  `,
})
export class DocumentOversightComponent {
  private readonly api = inject(DocumentsApi);
  protected company: number | null = null;
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly result = signal<Oversight | null>(null);

  protected async load() {
    if (!this.company || !Number.isInteger(this.company) || this.company < 1 || this.company > 2147483647 || this.busy()) return;
    this.busy.set(true); this.error.set(''); this.result.set(null);
    try { this.result.set(await firstValueFrom(this.api.oversight(this.company))); }
    catch (error) { this.error.set(apiErrorMessage(error)); }
    finally { this.busy.set(false); }
  }
}
