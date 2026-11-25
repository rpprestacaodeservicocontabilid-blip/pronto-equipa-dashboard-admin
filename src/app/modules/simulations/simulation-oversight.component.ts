import { KeyValuePipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { apiErrorMessage } from '../../core/api/api-error';
import { ComponentCardComponent } from '../../shared/components/common/component-card/component-card.component';
import { PageBreadcrumbComponent } from '../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { SimulationsApi } from './simulations-api.service';
import { Oversight } from './simulations.models';

@Component({
  standalone: true,
  imports: [FormsModule, KeyValuePipe, RouterLink, ComponentCardComponent, PageBreadcrumbComponent],
  styleUrl: './simulations.css',
  template: `
    <app-page-breadcrumb pageTitle="Simulation oversight" />
    <div class="space-y-5">
      <app-component-card title="Company simulation indicators">
        <form class="flex flex-wrap items-end gap-3" #scope="ngForm" (ngSubmit)="scope.valid && load()">
          <label class="sim-label">Company ID
            <input class="sim-input" type="number" min="1" max="2147483647" required name="company" [(ngModel)]="company" [disabled]="busy()">
          </label>
          <button type="submit" class="sim-primary" [disabled]="scope.invalid || busy()">View indicators</button>
          <a routerLink="/companies" class="sim-link self-center">Client companies</a>
        </form>
      </app-component-card>
      @if (busy()) { <p class="sim-muted" role="status">Loading indicators…</p> }
      @if (error()) { <p class="sim-error" role="alert">{{ error() }}</p> }
      @if (summary(); as result) {
        <app-component-card [title]="result.company.name">
          <div class="grid gap-4 sm:grid-cols-3">
            @for (group of groups; track group.key) {
              <section class="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                <h2 class="sim-label mb-3">{{ group.label }}</h2>
                <dl class="space-y-2 sim-muted">
                  @for (row of result[group.key] | keyvalue; track row.key) {
                    <div class="flex items-center justify-between gap-2">
                      <dt>{{ row.key.replaceAll('_', ' ') }}</dt><dd class="tabular-nums">{{ row.value }}</dd>
                    </div>
                  } @empty { <p>No records.</p> }
                </dl>
              </section>
            }
          </div>
        </app-component-card>
      }
    </div>
  `,
})
export class SimulationOversightComponent {
  private readonly api = inject(SimulationsApi);
  private readonly destroy = inject(DestroyRef);
  protected company: number | null = null;
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly summary = signal<Oversight | null>(null);
  protected readonly groups = [
    { key: 'scenarios', label: 'Scenarios' }, { key: 'runs', label: 'Runs' }, { key: 'proposals', label: 'Proposals' },
  ] as const;

  protected async load() {
    const company = this.company;
    if (company == null || !Number.isInteger(company) || company < 1 || company > 2147483647 || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.summary.set(null);
    try {
      this.summary.set(await firstValueFrom(this.api.oversight(company).pipe(takeUntilDestroyed(this.destroy))));
    } catch (error) {
      if (!this.destroy.destroyed) this.error.set(apiErrorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
