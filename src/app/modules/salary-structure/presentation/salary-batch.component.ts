import { Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { from, switchMap } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { CompanyWorkspace } from '../../../core/api/company-workspace-api';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { AuthSessionStore } from '../../auth/application/auth-session.store';
import { UUID, amount, human, money } from '../domain/salary-format';
import { Batch } from '../domain/salary.models';
import { can } from '../domain/salary-sections';
import { SalaryApi } from '../infrastructure/salary-api.service';
import { SalaryFormComponent } from './salary-form.component';
import { SalaryForm, currency, currencyValue, effectiveFrom, identity, string } from './salary-form';
import { employeeField, overrideFields, payInput, reasonField } from './salary-pay-forms';

@Component({
  selector: 'app-salary-batch',
  standalone: true,
  imports: [FormsModule, RouterLink, ComponentCardComponent, SalaryFormComponent],
  templateUrl: './salary-batch.component.html',
})
export class SalaryBatchComponent implements OnInit {
  @Input({ required: true }) context!: CompanyWorkspace;
  @Input() id = '';
  private readonly api = inject(SalaryApi);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthSessionStore);
  private readonly destroy = inject(DestroyRef);
  protected readonly batch = signal<Batch | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly form = signal<SalaryForm | null>(null);
  protected readonly notice = signal('');
  protected readonly money = money;
  protected readonly human = human;
  protected reference = '';
  protected get company() { return this.context.company.id; }
  protected can(grant: string) { return can(this.context.permissions, grant); }

  ngOnInit() { if (this.id) this.load(); }
  protected load() {
    if (!UUID.test(this.id)) { this.error.set('Enter a valid batch reference.'); return; }
    this.loading.set(true);
    this.error.set('');
    this.api.batch(this.company, this.id).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: batch => { this.batch.set(batch); this.loading.set(false); },
      error: error => { this.error.set(apiErrorMessage(error)); this.loading.set(false); },
    });
  }
  protected open() {
    if (!UUID.test(this.reference.trim())) { this.error.set('Enter a valid batch reference.'); return; }
    void this.router.navigate(['/salary-structure', this.company, 'revision-batches', this.reference.trim()]);
  }
  protected count(batch: Batch, status: string) { return batch.items.filter(item => item.status === status).length; }
  protected owns(batch: Batch) { return String(batch.requestedBy) === this.auth.claims()?.sub; }

  protected create() {
    this.form.set({
      title: 'Create bulk revision draft',
      description: 'Use a common structure and currency. Add employees below or paste one employee ID and base salary per line, separated by a semicolon.',
      fields: [
        { key: 'code', label: 'Batch code', required: true, max: 50 }, effectiveFrom(), currency(),
        identity('structureVersionId', 'Structure version ID', 'structure'), reasonField,
        { key: 'import', label: 'Pasted rows (employee ID; base salary)', kind: 'textarea', max: 64000 },
      ],
      group: { title: 'Employee entries', max: 1000, fields: [
        employeeField, { key: 'baseSalary', label: 'Proposed base salary', kind: 'amount', max: 19, required: true },
        { ...overrideFields[0], required: false }, ...overrideFields.slice(1).map(field => ({
          ...field, when: (values: Record<string, string | boolean>) => !!string(values, 'componentVersionId'),
        })),
      ] },
      submitLabel: 'Save draft',
      send: (values, rows) => {
        const common = { structureVersionId: string(values, 'structureVersionId'), currency: currencyValue(values) };
        const entered = rows.map(row => ({ employeeId: string(row, 'employeeId').toLowerCase(),
          ...payInput({ ...row, ...common }, string(row, 'componentVersionId') ? [row] : []) }));
        const pasted = string(values, 'import').split(/\r?\n/).filter(line => line.trim()).map((line, index) => {
          const columns = line.split(';').map(value => value.trim());
          if (columns.length !== 2 || !UUID.test(columns[0])) throw new Error('Check employee ID and base salary on pasted line ' + (index + 1) + '.');
          try { return { employeeId: columns[0].toLowerCase(), ...common, baseSalary: amount(columns[1], true), components: [] }; }
          catch { throw new Error('Check the base salary on pasted line ' + (index + 1) + '.'); }
        });
        const items = [...entered, ...pasted].sort((a, b) => a.employeeId.localeCompare(b.employeeId));
        if (!items.length || items.length > 1000) throw new Error('Enter from 1 to 1,000 employees.');
        if (new Set(items.map(item => item.employeeId)).size !== items.length) throw new Error('Each employee can appear only once.');
        const body = { code: string(values, 'code'), reason: string(values, 'reason'), effectiveFrom: string(values, 'effectiveFrom'), items };
        return from(crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(body)))).pipe(
          switchMap(digest => this.api.post(this.company, 'revision-batches', {
            ...body, idempotencyKey: 'admin-batch:' + Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join(''),
          })),
        );
      },
    });
  }

  protected action(action: 'validate' | 'approve' | 'apply') {
    const title = action === 'validate' ? 'Validate all entries' : action === 'approve' ? 'Approve batch' : 'Apply approved batch';
    this.form.set({
      title, fields: [], submitLabel: title,
      confirm: action === 'validate' ? undefined : 'I have reviewed the batch and confirm this action for the selected company.',
      send: () => this.api.post(this.company, 'revision-batches/' + encodeURIComponent(this.id) + '/' + action),
    });
  }

  protected saved(result: unknown) {
    const batch = result as Batch;
    this.form.set(null);
    if (!this.id) { void this.router.navigate(['/salary-structure', this.company, 'revision-batches', batch.id]); return; }
    this.batch.set(batch);
    this.notice.set('Batch status · ' + human(batch.status) + '.');
  }
}
