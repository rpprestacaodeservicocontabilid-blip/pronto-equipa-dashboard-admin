import { Component, DestroyRef, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { contractErrorMessage } from '../contract-errors';
import { CompanyContext, ContractRecord, DocumentSummary } from '../../domain/contracts.models';
import { ContractsApi } from '../../infrastructure/contracts-api.service';
import { ContractDocumentPickerComponent } from './contract-document-picker.component';
import { formatContractDate } from '../format-contract';

@Component({
  selector: 'app-contract-documents',
  standalone: true,
  imports: [FormsModule, ContractDocumentPickerComponent],
  templateUrl: './contract-documents.component.html',
})
export class ContractDocumentsComponent implements OnInit {
  @Input({ required: true }) context!: CompanyContext;
  @Input({ required: true }) id!: string;
  @Output() attached = new EventEmitter<void>();
  private readonly api = inject(ContractsApi);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly records = signal<ContractRecord[]>([]);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly access = signal<{ id: string; url: string; purpose: 'preview' | 'download' } | null>(null);
  protected selected: DocumentSummary | null = null;
  protected type = 'CONTRACT';
  protected readonly date = formatContractDate;

  ngOnInit() { this.load(); }

  protected get canLink() {
    return ['contracts.documents.manage', 'documents:read', 'documents:read-sensitive']
      .every(permission => this.context.permissions.includes(permission));
  }

  protected canOpen(purpose: 'preview' | 'download') {
    return this.context.permissions.includes('documents:read-sensitive')
      && this.context.permissions.includes('documents:' + purpose);
  }

  protected load() {
    if (!this.context.permissions.includes('contracts.documents.read')) return;
    this.loading.set(true);
    this.error.set('');
    this.api.records(this.context.company.id, this.id, 'documents').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: records => { this.records.set(records); this.loading.set(false); },
      error: error => { this.error.set(contractErrorMessage(error)); this.loading.set(false); },
    });
  }

  protected documentId(record: ContractRecord) {
    return typeof record.payload.documentId === 'string' ? record.payload.documentId : '';
  }

  protected documentType(value?: string) {
    switch (value) {
      case 'CONTRACT': return $localize`:@@contracts-contract:Contract`;
      case 'ATTACHMENT': return $localize`:@@contracts-attachment:Attachment`;
      case 'SUPPORTING': return $localize`:@@contracts-supporting-document:Supporting document`;
      default: return value ?? '—';
    }
  }

  protected link() {
    if (!this.selected || !this.canLink || this.busy()) return;
    if (this.records().some(record => this.documentId(record) === this.selected?.id && record.payload.documentType === this.type)) {
      this.error.set($localize`:@@contracts-that-document-is-already-linked-with-this-type:That document is already linked with this type.`);
      return;
    }
    this.error.set('');
    this.busy.set(true);
    this.api.attachDocument(this.context.company.id, this.id, this.selected.id, this.type)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.selected = null;
          this.busy.set(false);
          this.attached.emit();
        },
        error: error => { this.error.set(contractErrorMessage(error)); this.busy.set(false); },
      });
  }

  protected prepare(id: string, purpose: 'preview' | 'download') {
    if (this.busy() || !this.canOpen(purpose)) return;
    this.error.set('');
    this.access.set(null);
    this.busy.set(true);
    this.api.documentAccess(this.context.company.id, id, purpose).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: url => {
        if (/^https?:\/\//i.test(url)) {
          this.access.set({ id, url, purpose });
        } else {
          this.error.set($localize`:@@contracts-the-document-service-returned-an-invalid-link:The document service returned an invalid link.`);
        }
        this.busy.set(false);
      },
      error: error => { this.error.set(contractErrorMessage(error)); this.busy.set(false); },
    });
  }
}
