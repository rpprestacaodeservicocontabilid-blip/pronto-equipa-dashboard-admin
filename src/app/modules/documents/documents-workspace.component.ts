import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { apiErrorMessage } from '../../core/api/api-error';
import { ComponentCardComponent } from '../../shared/components/common/component-card/component-card.component';
import { PageBreadcrumbComponent } from '../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { DocumentsApi, Storage, storageUrl } from './documents-api.service';
import { canDocument, Section } from './documents.navigation';
import type { Access } from './documents.routes';

interface Row { id: string; status: string; createdAt: string; documentId?: string; data?: Record<string, unknown>; [key: string]: unknown }
interface Page { items: Row[]; total: number }
interface Upload { sessionId: string; mode: 'MULTIPART' | 'SINGLE'; partSizeBytes: number;
  parts: { partNumber: number; url: string; headers: Record<string, string> }[] }
type Action = { title: string; path: string; reason?: boolean; method?: 'POST' | 'PATCH'; name?: string; categoryCode?: string };
const columns: Record<string, [string, string][]> = {
  library: [['name','Document'], ['categoryCode','Category'], ['confidentiality','Confidentiality'], ['expiresAt','Expires'], ['sizeBytes','Bytes']],
  uploads: [['name','Document'], ['expectedSizeBytes','Bytes'], ['mode','Transfer'], ['quarantineReason','Security result']],
  batches: [['total','Files'], ['failed','Failed'], ['createdBy','Operator']],
  deletions: [['reason','Reason'], ['requestedBy','Requested by'], ['decisionReason','Decision']],
  holds: [['reason','Reason'], ['reference','Reference'], ['createdBy','Operator']],
  reviews: [['submittedBy','Submitted by'], ['decidedBy','Reviewer'], ['reason','Decision reason']],
  categories: [['code','Code'], ['name','Name'], ['scope','Scope'], ['confidentiality','Confidentiality']],
  audit: [['purpose','Operation'], ['actorUserId','Operator'], ['versionId','Version'], ['at','Time']],
};
const emptyPolicy = { requireValidation: true, defaultConfidentiality: 'RESTRICTED', maxFileBytes: 104857600, defaultRetentionDays: 0 };

@Component({
  standalone: true, imports: [DatePipe, FormsModule, RouterLink, ComponentCardComponent, PageBreadcrumbComponent],
  templateUrl: './documents-workspace.component.html', styleUrl: './documents.css',
})
export class DocumentsWorkspaceComponent {
  private readonly api = inject(DocumentsApi);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy = inject(DestroyRef);
  protected readonly section = this.route.snapshot.data['section'] as Section;
  protected readonly columns = columns[this.section.view] ?? [];
  protected readonly rows = signal<Row[]>([]);
  protected readonly detail = signal<Row | null>(null);
  protected readonly related = signal<{title: string; rows: Row[]} | null>(null);
  protected readonly storage = signal<Storage | null>(null);
  protected readonly policy = signal<typeof emptyPolicy | null>(null);
  protected readonly link = signal<string | null>(null);
  protected readonly error = signal('');
  protected readonly denied = signal('');
  protected readonly notice = signal('');
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly action = signal<Action | null>(null);
  protected readonly uploadResults = signal<{ index: number; file: string; status: string }[]>([]);
  protected access?: Access;
  protected company = 0;
  protected companyName = '';
  protected search = '';
  protected status = '';
  protected categoryCode = '';
  protected page = 1;
  protected total: number | null = null;
  protected reason = '';
  protected name = '';
  protected actionCategory = '';
  protected expires = '';
  protected files: File[] = [];
  protected categories = signal<Row[]>([]);
  protected readonly states = ['ACTIVE', 'PENDING_UPLOAD', 'SCANNING', 'PENDING_VALIDATION', 'QUARANTINED', 'REJECTED',
    'EXPIRED', 'ARCHIVED', 'PENDING_DELETION', 'DELETED'];
  protected readonly confidentiality = ['PUBLIC_INTERNAL', 'RESTRICTED', 'CONFIDENTIAL', 'HIGHLY_CONFIDENTIAL'];
  protected category = { code: '', name: '', scope: 'COMPANY', confidentiality: 'RESTRICTED' };
  private revision = 0;
  private selection = 0;
  private transfer = new AbortController();

  constructor() {
    this.destroy.onDestroy(() => this.transfer.abort());
    this.route.data.pipe(takeUntilDestroyed()).subscribe(({access}) => {
      this.transfer.abort(); this.transfer = new AbortController();
      this.access = access; this.company = 'context' in access ? access.context.company.id : 0;
      this.companyName = 'context' in access ? access.context.company.name : '';
      this.denied.set('error' in access ? access.error :
        access.context.company.status !== 'ACTIVE' || !this.can(...this.section.permissions) ? 'This section requires company document permissions.' : '');
      this.rows.set([]); this.storage.set(null); this.policy.set(null); this.categories.set([]);
      this.uploadResults.set([]); this.files = []; this.notice.set(''); this.error.set(''); this.close();
      void this.load();
    });
  }
  protected can(...permissions: string[]) {
    return this.access && 'context' in this.access && canDocument(this.access.context.permissions, ...permissions);
  }
  protected label(value: string) { return value.toLowerCase().replaceAll('_', ' ').replace(/^./, letter => letter.toUpperCase()); }
  protected field(row: Row, field: string) { return row[field] ?? row.data?.[field]; }
  protected text(value: unknown) { return typeof value === 'string' || typeof value === 'number' ? String(value) : '—'; }
  protected async load(page = 1) {
    const revision = ++this.revision;
    if (!this.company || this.denied()) { this.loading.set(false); return; }
    this.error.set(''); this.loading.set(true); this.rows.set([]); this.total = null; this.page = page;
    try {
      const view = this.section.view;
      const company = this.company;
      const params = { page, limit: 25 };
      if (view === 'upload' || view === 'categories') {
        const data = this.can('read') ? await firstValueFrom(this.api.get<Row[]>(company, '/categories')) : [];
        if (revision === this.revision) { this.categories.set(data); this.rows.set(data); }
      } else if (view === 'storage') {
        const data = await firstValueFrom(this.api.get<Storage>(company, '/storage/usage'));
        if (revision === this.revision) this.storage.set(data);
      } else if (view === 'policies') {
        const data = await firstValueFrom(this.api.get<Partial<typeof emptyPolicy>>(company, '/policies'));
        if (revision === this.revision) this.policy.set({ ...emptyPolicy, ...data });
      } else if (view === 'library' || view === 'audit') {
        const filters = { ...params, ...(view === 'library' ? {
          ...(this.search.trim() ? { search: this.search.trim() } : {}), ...(this.status ? { status: this.status } : {}),
          ...(this.categoryCode.trim() ? { categoryCode: this.categoryCode.trim() } : {}), ...this.section.filters,
        } : {}) };
        const data = await firstValueFrom(this.api.get<Row[]>(company, view === 'library' ? '' : '/audit/access', filters));
        if (revision === this.revision) this.rows.set(data);
      } else {
        const data = await firstValueFrom(this.api.get<Page>(company, '/operations/' + view, params));
        if (revision === this.revision) { this.rows.set(data.items); this.total = data.total; }
      }
    } catch (error) { if (revision === this.revision) this.error.set(apiErrorMessage(error)); }
    finally { if (revision === this.revision) this.loading.set(false); }
  }
  protected close() { this.selection++; this.detail.set(null); this.action.set(null); this.related.set(null); this.link.set(null); }
  protected choose(row: Row) { this.close(); this.detail.set(row); }
  protected actions(row: Row): Action[] {
    const path = '/' + row.id;
    if (this.section.view === 'holds') return row.status === 'ACTIVE' && this.can('legal-holds:release')
      ? [{ title: 'Release hold', path: '/legal-holds/' + row.id + '/release', reason: true }] : [];
    if (this.section.view === 'deletions') return row.status === 'PENDING'
      ? ['approve', 'reject'].map(verb => ({ title: this.label(verb) + ' deletion request', path: '/deletion-requests/' + row.id + '/' + verb, reason: true })) : [];
    if (this.section.view !== 'library') return [];
    const result: Action[] = [];
    if (row.status === 'ACTIVE' && this.can('archive')) result.push({ title: 'Archive', path: path + '/archive' });
    if (row.status === 'ARCHIVED' && this.can('restore')) result.push({ title: 'Restore', path: path + '/restore' });
    if (row.status === 'PENDING_VALIDATION') {
      if (this.can('validation:submit')) result.push({ title: 'Submit for review', path: path + '/validation/submit' });
      for (const verb of ['approve', 'reject']) if (this.can('validation:' + verb))
        result.push({ title: this.label(verb) + ' document', path: path + '/validation/' + verb, reason: true });
    }
    if (!['DELETED','PENDING_DELETION'].includes(row.status)) {
      if (this.can('metadata:update')) result.push({ title: 'Edit metadata', path, method: 'PATCH', name: String(row['name'] ?? ''),
        categoryCode: String(row['categoryCode'] ?? '') });
      if (this.can('legal-holds:create')) result.push({ title: 'Place legal hold', path: path + '/legal-holds', reason: true });
      if (this.can('deletion:request')) result.push({ title: 'Request deletion', path: path + '/deletion-requests', reason: true });
    }
    return result;
  }
  protected start(action: Action) {
    this.reason = ''; this.name = action.name ?? ''; this.actionCategory = action.categoryCode ?? ''; this.expires = '';
    this.error.set(''); this.action.set(action);
  }
  protected confirm(action: Action) {
    if (action.reason && this.reason.trim().length < 3) return;
    const body = action.method === 'PATCH' ? { name: this.name.trim(), categoryCode: this.actionCategory.trim() || null,
      ...(this.expires ? { expiresAt: new Date(this.expires + 'T23:59:59+01:00').toISOString() } : {}) } :
      action.reason ? { reason: this.reason.trim() } : {};
    return this.save(action.path, body, action.method);
  }
  protected savePolicy(policy: typeof emptyPolicy) {
    const { requireValidation, defaultConfidentiality, maxFileBytes, defaultRetentionDays } = policy;
    return this.save('/policies', { requireValidation, defaultConfidentiality, maxFileBytes, defaultRetentionDays }, 'PUT');
  }
  protected saveCategory() { return this.save('/categories', this.category); }
  private async save(path: string, body: object, method: 'POST' | 'PATCH' | 'PUT' = 'POST') {
    if (this.busy()) return;
    const company = this.company;
    this.error.set(''); this.busy.set(true);
    try {
      await firstValueFrom(this.api.write(company, path, body, method));
      if (company !== this.company) return;
      this.close(); this.notice.set('Operation recorded.'); await this.load(this.page);
    } catch (error) { if (company === this.company) this.error.set(apiErrorMessage(error)); }
    finally { this.busy.set(false); }
  }
  protected async show(row: Row, type: 'versions' | 'associations' | 'preview' | 'download' | 'batch') {
    const selection = ++this.selection;
    const company = this.company;
    this.related.set(null); this.link.set(null); this.error.set('');
    try {
      if (type === 'download' || type === 'preview') {
        const data = await firstValueFrom(this.api.get<{url: string}>(company, '/' + row.id + '/' + type));
        if (selection === this.selection) this.link.set(storageUrl(data.url));
      } else {
        const path = type === 'batch' ? '/batches/' + row.id + '/progress' : '/' + row.id + '/' + type;
        const data = await firstValueFrom(this.api.get<Row[] | {items: Row[]}>(company, path));
        if (selection === this.selection) this.related.set({ title: this.label(type), rows: Array.isArray(data) ? data : data.items });
      }
    } catch (error) { if (selection === this.selection) this.error.set(apiErrorMessage(error)); }
  }
  protected fileChange(event: Event) {
    this.files = Array.from((event.target as HTMLInputElement).files ?? []);
    this.uploadResults.set([]);
  }
  protected async upload(category = '', version?: Row) {
    const files = this.files;
    if (this.busy() || !files.length) return;
    if (files.length > 20 || (version && files.length !== 1)) { this.error.set('Choose up to 20 files, or one file for a replacement.'); return; }
    const company = this.company;
    const signal = this.transfer.signal;
    this.busy.set(true); this.error.set(''); this.uploadResults.set([]);
    try {
      for (const [index, file] of files.entries()) {
        if (signal.aborted) break;
        let upload: Upload | undefined;
        let completing = false;
        try {
          upload = await firstValueFrom(this.api.write<Upload>(company, version ? '/' + version.id + '/versions' : '/uploads',
            { name: file.name, sizeBytes: file.size, mimeType: file.type || 'application/octet-stream', idempotencyKey: crypto.randomUUID(),
              ...(category ? { categoryCode: category } : {}) }));
          const parts: { partNumber: number; etag: string }[] = [];
          for (const part of upload.parts) {
            const start = (part.partNumber - 1) * upload.partSizeBytes;
            const data = upload.mode === 'SINGLE' ? file : file.slice(start, start + upload.partSizeBytes);
            const response = await fetch(storageUrl(part.url), {
              method: 'PUT', body: data, headers: part.headers, signal, credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer',
            });
            if (!response.ok) throw new Error('Storage rejected the upload.');
            if (upload.mode === 'MULTIPART') {
              const etag = response.headers.get('ETag');
              if (!etag) throw new Error('Storage did not expose the part ETag.');
              parts.push({ partNumber: part.partNumber, etag });
            }
          }
          completing = true;
          await firstValueFrom(this.api.write(company, '/uploads/' + upload.sessionId + '/complete', { parts }));
          if (!signal.aborted) this.uploadResults.update(rows => [...rows, { index, file: file.name, status: 'Received for security checks' }]);
        } catch (error) {
          if (upload && !completing) await firstValueFrom(this.api.write(company, '/uploads/' + upload.sessionId, null, 'DELETE')).catch(() => undefined);
          if (!signal.aborted) this.uploadResults.update(rows => [...rows, { index, file: file.name, status: apiErrorMessage(error) }]);
        }
      }
      if (!signal.aborted) { this.files = []; if (version) await this.load(this.page); }
    } finally { this.busy.set(false); }
  }
}
