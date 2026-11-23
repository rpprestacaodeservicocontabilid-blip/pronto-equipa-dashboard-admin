import { Component, DestroyRef, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ContractsApi } from '../../infrastructure/contracts-api.service';
import { DocumentSummary } from '../../domain/contracts.models';
import { apiErrorMessage } from '../../../../core/api/api-error';

@Component({
  selector: 'app-contract-document-picker',
  standalone: true,
  imports: [FormsModule],
  template: `
    <label class="field">
      Available documents
      <select class="control" [ngModel]="selected?.id ?? ''" (ngModelChange)="select($event)" [disabled]="loading()">
        <option value="">Select an active document</option>
        @if (selected && !inCurrentPage(selected.id)) { <option [value]="selected.id">{{ selected.name }}</option> }
        @for (entry of documents(); track entry.id) { <option [value]="entry.id">{{ entry.name }}</option> }
      </select>
    </label>
    <div class="mt-2 flex flex-wrap items-center gap-2">
      <button class="action" type="button" [disabled]="loading() || page() === 1" (click)="load(page() - 1)">Previous</button>
      <button class="action" type="button" [disabled]="loading() || documents().length < 25" (click)="load(page() + 1)">Next</button>
      <span class="text-sm text-gray-600 dark:text-gray-400">Page {{ page() }}</span>
      @if (previewAllowed && selected) {
        @if (preview(); as link) {
          @if (link.id === selected.id) {
            <a class="action" [href]="link.url" target="_blank" rel="noopener noreferrer">Open preview</a>
          }
        }
        <button class="action" type="button" [disabled]="previewLoading()" (click)="preparePreview()">Prepare preview</button>
      }
    </div>
    @if (loading()) { <p role="status" class="mt-2 text-sm text-gray-600 dark:text-gray-400">Loading documents…</p> }
    @if (error()) {
      <p role="alert" class="feedback mt-2">{{ error() }}</p>
      <button class="action mt-2" type="button" (click)="load(page())">Try again</button>
    }
  `,
})
export class ContractDocumentPickerComponent implements OnInit {
  @Input({ required: true }) companyId!: number;
  @Input() selected: DocumentSummary | null = null;
  @Input() previewAllowed = false;
  @Output() selectedChange = new EventEmitter<DocumentSummary | null>();

  private readonly api = inject(ContractsApi);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly page = signal(1);
  protected readonly documents = signal<DocumentSummary[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly previewLoading = signal(false);
  protected readonly preview = signal<{ id: string; url: string } | null>(null);

  ngOnInit() { this.load(1); }

  protected load(page: number) {
    this.loading.set(true);
    this.error.set('');
    this.api.documentPage(this.companyId, page).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: documents => { this.documents.set(documents); this.page.set(page); this.loading.set(false); },
      error: error => { this.error.set(apiErrorMessage(error)); this.loading.set(false); },
    });
  }

  protected inCurrentPage(id: string) { return this.documents().some(entry => entry.id === id); }

  protected select(id: string) {
    this.preview.set(null);
    const selected = this.documents().find(entry => entry.id === id) ?? (id === this.selected?.id ? this.selected : null);
    this.selectedChange.emit(selected);
  }

  protected preparePreview() {
    if (!this.previewAllowed || !this.selected || this.previewLoading()) return;
    const id = this.selected.id;
    this.error.set('');
    this.previewLoading.set(true);
    this.api.documentAccess(this.companyId, id, 'preview').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: url => {
        if (/^https?:\/\//i.test(url)) this.preview.set({ id, url });
        else this.error.set('The document service returned an invalid link.');
        this.previewLoading.set(false);
      },
      error: error => { this.error.set(apiErrorMessage(error)); this.previewLoading.set(false); },
    });
  }
}
