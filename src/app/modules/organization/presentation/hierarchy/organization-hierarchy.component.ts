import { NgTemplateOutlet } from '@angular/common';
import { activeLocale } from '../../../../core/i18n/locale';
import { Component, DestroyRef, Input, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, from, map, mergeMap, of, switchMap, toArray } from 'rxjs';
import { CompanyWorkspace } from '../../../../core/api/company-workspace-api';
import { organizationErrorMessage, organizationOptionLabel } from '../organization-display';
import { ComponentCardComponent } from '../../../../shared/components/common/component-card/component-card.component';
import { DepartmentNode, OrganizationRecord } from '../../domain/organization.models';
import { descendantIds, isoDate } from '../../domain/organization-validation';
import { OrganizationApi } from '../../infrastructure/organization-api.service';

@Component({
  selector: 'app-organization-hierarchy',
  standalone: true,
  imports: [FormsModule, NgTemplateOutlet, RouterLink, ComponentCardComponent],
  templateUrl: './organization-hierarchy.component.html',
})
export class OrganizationHierarchyComponent implements OnInit {
  protected readonly statusLabel = organizationOptionLabel;
  private readonly dateFormatter = new Intl.DateTimeFormat(activeLocale(), { dateStyle: 'medium', timeZone: 'UTC' });

  protected toggleLabel(name: string) {
    return $localize`:@@organization-toggle-department:Toggle ${name}:NAME:`;
  }

  @Input({ required: true }) context!: CompanyWorkspace;
  private readonly api = inject(OrganizationApi);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly current = signal<DepartmentNode[]>([]);
  protected readonly historical = signal<DepartmentNode[] | null>(null);
  protected readonly expanded = signal(new Set<string>());
  protected readonly selected = signal<DepartmentNode | null>(null);
  protected readonly search = signal('');
  protected readonly managers = signal(new Map<string, string>());
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly today = isoDate(new Date());
  protected asOf = this.today;
  protected parent = '';
  protected readonly roots = computed(() => this.historical() ?? this.current());
  protected readonly allNodes = computed(() => flatten(this.current()));
  protected readonly parentOptions = computed(() => {
    const selected = this.selected();
    if (!selected) return [];
    const excluded = descendantIds(selected);
    return this.allNodes().filter(node => node.status === 'ACTIVE' && !excluded.has(node.id));
  });
  protected readonly visible = computed(() => {
    const search = this.search().trim().toLocaleLowerCase();
    if (!search) return this.roots();
    const found = (nodes: DepartmentNode[]): DepartmentNode[] => nodes.flatMap(node => {
      const children = found(node.children);
      const matches = [node.name, node.code, this.manager(node)].some(value => value.toLocaleLowerCase().includes(search));
      return matches || children.length ? [{ ...node, children: matches ? node.children : children }] : [];
    });
    return found(this.roots());
  });

  ngOnInit() { this.load(); }

  protected manager(node: DepartmentNode) {
    const id = node.data['managerEmployeeId'];
    return typeof id === 'string' ? this.managers().get(id) ?? $localize`:@@organization-manager-assigned:Manager assigned` : '';
  }

  protected load() {
    this.loading.set(true);
    this.error.set('');
    const company = this.context.company.id;
    const employees = this.context.permissions.includes('employees.read')
      ? this.api.employees(company).pipe(catchError(() => of([]))) : of([]);
    forkJoin({ nodes: this.api.tree(company), employees }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ nodes, employees }) => {
        this.current.set(nodes);
        this.managers.set(new Map(employees.map(entry => [entry.id, entry.firstName + ' ' + entry.lastName])));
        this.expanded.set(new Set(nodes.map(node => node.id)));
        this.loading.set(false);
      },
      error: error => { this.error.set(organizationErrorMessage(error)); this.loading.set(false); },
    });
  }

  protected toggle(id: string) {
    const next = new Set(this.expanded());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.expanded.set(next);
  }

  protected beginMove(node: DepartmentNode) {
    this.error.set('');
    this.notice.set('');
    this.selected.set(node);
    this.parent = node.parentId ?? '';
  }

  protected move() {
    const node = this.selected();
    if (!node || this.saving() || (node.parentId ?? '') === this.parent
      || (this.parent && !this.parentOptions().some(parent => parent.id === this.parent))) return;
    this.saving.set(true);
    this.error.set('');
    this.api.move(this.context.company.id, node, this.parent || null).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        this.selected.set(null);
        this.notice.set($localize`:@@organization-department-moved-the-previous-structure-is-preserved-in-history:Department moved. The previous structure is preserved in history.`);
        this.load();
      },
      error: error => { this.saving.set(false); this.error.set(organizationErrorMessage(error)); },
    });
  }

  protected showHistory() {
    if (!this.asOf || this.asOf > this.today || this.loading()) return;
    this.selected.set(null);
    this.loading.set(true);
    this.error.set('');
    this.notice.set('');
    const cutoff = this.asOf;
    const company = this.context.company.id;
    this.api.tree(company).pipe(
      switchMap(roots => from(flatten(roots)).pipe(
        mergeMap(node => this.api.history(company, 'departments', node.id).pipe(
          map(records => records.filter(record => record.createdAt.slice(0, 10) <= cutoff).at(-1)?.newData),
        ), 4), toArray(),
      )),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: records => {
        const visible = records.filter((record): record is OrganizationRecord => !!record);
        const nodes = new Map<string, DepartmentNode>(visible.map(record => [record.id, { ...record, children: [] }]));
        const roots: DepartmentNode[] = [];
        for (const node of nodes.values()) {
          const parent = node.parentId ? nodes.get(node.parentId) : undefined;
          if (parent) parent.children.push(node);
          else roots.push(node);
        }
        this.historical.set(roots);
        this.expanded.set(new Set(nodes.keys()));
        const date = this.dateFormatter.format(new Date(cutoff + 'T00:00:00Z'));
        this.notice.set($localize`:@@organization-structure-at-date:Structure at the end of ${date}:DATE:.`);
        this.loading.set(false);
      },
      error: error => { this.error.set(organizationErrorMessage(error)); this.loading.set(false); },
    });
  }

  protected currentStructure() {
    this.historical.set(null);
    this.notice.set('');
    this.error.set('');
    this.expanded.set(new Set(this.current().map(node => node.id)));
  }
}

function flatten(roots: DepartmentNode[]): DepartmentNode[] {
  return roots.flatMap(node => [node, ...flatten(node.children)]);
}
