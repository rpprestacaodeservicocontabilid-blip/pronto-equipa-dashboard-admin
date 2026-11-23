import { Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Observable, Subject, catchError, from, map, mergeMap, of, switchMap, toArray } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/api-error';
import { CompanyWorkspace } from '../../../core/api/company-workspace-api';
import { ComponentCardComponent } from '../../../shared/components/common/component-card/component-card.component';
import { AuthSessionStore } from '../../auth/application/auth-session.store';
import { TODAY, UUID, amount, cents, effective, human, money } from '../domain/salary-format';
import { CALCULATION_METHODS, COMPONENT_TYPES, Catalog, CatalogRecord, ComponentDetail, FREQUENCIES, Grade, StructureDetail, TableDetail, Version } from '../domain/salary.models';
import { can } from '../domain/salary-sections';
import { SalaryApi } from '../infrastructure/salary-api.service';
import { componentFields, componentInput, createComponentFields, editComponentFields, gradeFields, gradeInput, recordFields, structureFields, structureItems } from './salary-catalog-forms';
import { SalaryFormComponent } from './salary-form.component';
import { SalaryForm, effectiveFrom, string } from './salary-form';

type Detail = ComponentDetail | TableDetail | StructureDetail;
type CatalogView = { rows: CatalogRecord[]; total: number; local?: boolean; detail?: Detail; versions?: Map<string, ComponentDetail['versions'][number]> };
const CREATE = { components: 'components:create', tables: 'tables:manage', structures: 'structures:create' };

@Component({
  selector: 'app-salary-catalog',
  standalone: true,
  imports: [FormsModule, RouterLink, ComponentCardComponent, SalaryFormComponent],
  templateUrl: './salary-catalog.component.html',
})
export class SalaryCatalogComponent implements OnInit {
  @Input({ required: true }) context!: CompanyWorkspace;
  @Input({ required: true }) mode!: string;
  @Input({ required: true }) title!: string;
  @Input() id = '';
  private readonly api = inject(SalaryApi);
  private readonly auth = inject(AuthSessionStore);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  private readonly reload = new Subject<void>();
  protected readonly data = signal<CatalogView | null>(null);
  protected readonly form = signal<SalaryForm | null>(null);
  protected readonly loading = signal(false);
  protected readonly notice = signal('');
  protected readonly error = signal('');
  protected readonly human = human;
  protected readonly money = money;
  protected readonly types = COMPONENT_TYPES;
  protected readonly methods = CALCULATION_METHODS;
  protected readonly frequencies = FREQUENCIES;
  protected page = 1;
  protected filters = { search: '', status: '', type: '', method: '', frequency: '' };
  private applied = { ...this.filters };
  private createdKind: Catalog | undefined;

  protected get resource(): Catalog {
    if (this.mode === 'allowances') return 'components';
    if (this.mode === 'grades') return 'tables';
    return this.mode as Catalog;
  }
  protected get company() { return this.context.company.id; }
  protected get allowCreate() { return this.mode !== 'grades' && this.can(CREATE[this.resource]); }
  protected can(permission: string) { return can(this.context.permissions, permission); }
  protected isComponent(detail: Detail): detail is ComponentDetail { return this.resource === 'components'; }
  protected isTable(detail: Detail): detail is TableDetail { return 'grades' in detail; }
  protected isStructure(detail: Detail): detail is StructureDetail { return 'items' in detail; }
  protected asComponent(version: Version) { return version as ComponentDetail['versions'][number]; }

  ngOnInit() {
    if (!this.can('read')) return;
    this.reload.pipe(switchMap(() => {
      this.loading.set(true);
      this.error.set('');
      this.data.set(null);
      return this.read().pipe(map(data => ({ data })), catchError(error => of({ error: apiErrorMessage(error) })));
    }), takeUntilDestroyed(this.destroy)).subscribe(result => {
      this.loading.set(false);
      if ('error' in result) this.error.set(result.error); else this.data.set(result.data);
    });
    this.refresh();
  }
  protected refresh() { this.reload.next(); }
  protected apply() { this.applied = { ...this.filters }; this.page = 1; this.refresh(); }
  protected go(page: number) { this.page = page; if (!this.data()?.local) this.refresh(); }
  protected visible(data: CatalogView) { return data.local ? data.rows.slice((this.page - 1) * 20, this.page * 20) : data.rows; }
  protected own(version: Version) { return String(version.createdBy) === this.auth.claims()?.sub; }
  protected newestDraft(detail: TableDetail) { return detail.versions.find(version => version.status === 'DRAFT'); }

  protected create() {
    this.createdKind = this.resource;
    const catalog = this.resource;
    if (catalog === 'components') {
      this.form.set({
        title: 'Create salary component', description: 'Use the versioned classification reference supplied by legal rules.',
        fields: createComponentFields(this.mode === 'allowances'), send: values => this.api.post(this.company, catalog, {
          code: string(values, 'code'), name: string(values, 'name'), description: string(values, 'description') || undefined,
          ...componentInput(values),
        }),
      });
      return;
    }
    const table = catalog === 'tables';
    this.form.set({
      title: table ? 'Create salary table' : 'Create pay structure',
      fields: [...recordFields, effectiveFrom()],
      group: table ? undefined : { title: 'Structure components', fields: structureFields, min: 1 },
      send: (values, rows) => this.api.post(this.company, catalog, {
        code: string(values, 'code'), name: string(values, 'name'), effectiveFrom: string(values, 'effectiveFrom'),
        ...(table ? {} : { items: structureItems(rows) }),
      }),
    });
  }

  protected edit(detail: ComponentDetail) {
    this.form.set({ title: 'Edit component identification', fields: editComponentFields(detail.name, detail.description),
      send: values => this.api.patch(this.company, this.path(), { name: string(values, 'name'), description: string(values, 'description') || null }) });
  }

  protected version(detail: Detail) {
    if (this.isComponent(detail)) {
      this.form.set({ title: 'New component version', fields: componentFields(false, detail.versions[0]),
        send: values => this.api.post(this.company, this.path('versions'), componentInput(values)) });
      return;
    }
    this.form.set({ title: 'New draft version', fields: [effectiveFrom()],
      group: this.isStructure(detail) ? {
        title: 'Structure components', fields: structureFields, min: 1,
        rows: detail.items.filter(item => item.structureVersionId === detail.versions[0]?.id).map(item => ({
          componentVersionId: item.componentVersionId, amount: String(item.amount ?? ''), percentage: String(item.percentage ?? ''), required: item.required,
          originalConfig: JSON.stringify(item.calculationConfig),
        })),
      } : undefined,
      send: (values, rows) => this.api.post(this.company, this.path('versions'), {
        effectiveFrom: string(values, 'effectiveFrom'), ...(this.isStructure(detail) ? { items: structureItems(rows) } : {}),
      }),
    });
  }

  protected grade() {
    this.form.set({ title: 'Add grade to the newest draft', fields: gradeFields,
      send: values => this.api.post(this.company, this.path('grades'), gradeInput(values)) });
  }

  protected step(grade: Grade) {
    this.form.set({ title: 'Add step · ' + grade.name, fields: [...recordFields, { key: 'amount', label: 'Amount', kind: 'amount', required: true, max: 19 }],
      send: values => {
        const value = amount(string(values, 'amount'));
        if (cents(value)! < cents(grade.minAmount)! || cents(value)! > cents(grade.maxAmount)!) throw new Error('Step amount must be within the grade range.');
        return this.api.post(this.company, 'grades/' + encodeURIComponent(grade.id) + '/steps', {
          code: string(values, 'code'), name: string(values, 'name'), amount: value, currency: grade.currency,
        });
      } });
  }

  protected action(title: string, route: string, body: unknown = {}) {
    this.form.set({ title, fields: [], confirm: 'I confirm this change for the selected company.',
      submitLabel: title, send: () => this.api.post(this.company, this.path(route), body) });
  }

  protected cancel() { this.form.set(null); this.createdKind = undefined; }
  protected completed(result: unknown) {
    const kind = this.createdKind;
    this.cancel();
    this.notice.set('Saved successfully.');
    if (kind && this.can('read')) {
      const responseKey = { components: 'component', tables: 'table', structures: 'structure' }[kind];
      const id = (result as Record<string, { id?: string }>)[responseKey]?.id;
      if (id) { void this.router.navigate(['/salary-structure', this.company, this.mode, id]); return; }
    }
    this.refresh();
  }

  private path(suffix = '') { return this.resource + '/' + encodeURIComponent(this.id) + (suffix ? '/' + suffix : ''); }

  private read(): Observable<CatalogView> {
    if (this.id) return UUID.test(this.id)
      ? this.api.catalog(this.company, this.resource, this.id).pipe(map(detail => ({ detail, rows: [], total: 1 })))
      : of({ rows: [], total: 0 });
    const filter = this.applied;
    const search = filter.search.trim().toLowerCase();
    const details = this.resource === 'components' && (this.mode === 'allowances' || filter.type || filter.method || filter.frequency);
    const query = filter.status ? { status: filter.status } : {};
    if (!search && !details) return this.api.page<CatalogRecord>(this.company, this.resource, query, this.page).pipe(
      switchMap(result => this.resource !== 'components' ? of({ rows: result.data, total: result.total })
        : this.versions(result.data).pipe(map(versions => ({ rows: result.data, total: result.total, versions })))),
    );
    const all = this.api.all(page => this.api.page<CatalogRecord>(this.company, this.resource, query, page, 100)).pipe(
      map(records => records.filter(row => (row.code + ' ' + row.name).toLowerCase().includes(search))),
    );
    if (!details) return all.pipe(switchMap(rows => this.resource !== 'components'
      ? of({ rows, total: rows.length, local: true })
      : this.versions(rows).pipe(map(versions => ({ rows, total: rows.length, local: true, versions })))));
    return all.pipe(switchMap(records => from(records).pipe(
      mergeMap(row => this.api.catalog(this.company, 'components', row.id).pipe(map(detail => detail as ComponentDetail)), 4),
      toArray(), map(records => {
        const result = new Map<string, ComponentDetail['versions'][number]>();
        const rows = records.filter(record => {
          const version = record.versions.find(version => ['PUBLISHED', 'SUPERSEDED'].includes(version.status) && effective(version, TODAY())) ?? record.versions[0];
          if (!version) return false;
          const include = (this.mode !== 'allowances' || ['ALLOWANCE', 'BENEFIT'].includes(version.componentType)) &&
            (!filter.type || filter.type === version.componentType) && (!filter.method || filter.method === version.calculationMethod) &&
            (!filter.frequency || filter.frequency === version.frequency);
          if (include) result.set(record.id, version);
          return include;
        }).sort((a, b) => a.code.localeCompare(b.code));
        return { rows, total: rows.length, local: true, versions: result };
      }),
    )));
  }

  private versions(records: CatalogRecord[]) {
    return from(records).pipe(
      mergeMap(record => this.api.catalog(this.company, 'components', record.id).pipe(
        map(result => ({ id: record.id, versions: (result as ComponentDetail).versions })),
        catchError(() => of({ id: record.id, versions: [] })),
      ), 4),
      toArray(),
      map(details => {
        const result = new Map<string, ComponentDetail['versions'][number]>();
        for (const detail of details) {
          const version = detail.versions.find(version => ['PUBLISHED', 'SUPERSEDED'].includes(version.status) && effective(version, TODAY())) ?? detail.versions[0];
          if (version) result.set(detail.id, version);
        }
        return result;
      }),
    );
  }
}
