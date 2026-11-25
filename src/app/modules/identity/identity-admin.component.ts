import { DatePipe } from '@angular/common';
import { Component, DestroyRef, PendingTasks, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable, firstValueFrom } from 'rxjs';
import { apiErrorMessage } from '../../core/api/api-error';
import { ComponentCardComponent } from '../../shared/components/common/component-card/component-card.component';
import { PageBreadcrumbComponent } from '../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { IdentityAction, IdentityAdminApi, IdentityDetails, IdentityPage } from './identity-admin.api';

@Component({
  standalone: true,
  imports: [FormsModule, DatePipe, RouterLink, ComponentCardComponent, PageBreadcrumbComponent],
  styleUrl: './identity-admin.component.css',
  templateUrl: './identity-admin.component.html',
})
export class IdentityAdminComponent {
  private readonly api = inject(IdentityAdminApi);
  private readonly destroy = inject(DestroyRef);
  private readonly pending = inject(PendingTasks);
  protected readonly disabledOnly = inject(ActivatedRoute).snapshot.data['disabled'] === true;
  protected readonly page = signal<IdentityPage | null>(null);
  protected readonly selected = signal<IdentityDetails | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly action = signal<IdentityAction | null>(null);
  protected readonly actionNames = { disable: 'Disable sign-in', enable: 'Restore sign-in', 'revoke-sessions': 'Revoke all sessions' };
  protected search = '';
  protected name = '';
  protected reason = '';
  private appliedSearch = '';

  constructor() { this.list(1); }

  protected list(page: number) {
    void this.run(async () => {
      if (page === 1) this.appliedSearch = this.search.trim();
      this.page.set(await this.request(this.api.list(page, this.appliedSearch, this.disabledOnly)));
    });
  }
  protected open(id: number) {
    void this.run(async () => {
      this.action.set(null);
      this.selected.set(null);
      await this.loadIdentity(id);
    });
  }
  protected rename(row: IdentityDetails) {
    const name = this.name.trim();
    if (name.length < 2 || name === row.name) return;
    void this.run(async () => {
      await this.request(this.api.rename(row.id, name));
      this.notice.set('Display name updated.');
      await this.refresh(row.id);
    });
  }
  protected prepare(action: IdentityAction) {
    this.reason = '';
    this.action.set(action);
  }
  protected confirm(row: IdentityDetails, action: IdentityAction) {
    const reason = this.reason.trim();
    if (reason.length < 5 || row.protectedAccount) return;
    void this.run(async () => {
      const { data } = await this.request(this.api.act(row.id, action, reason));
      this.action.set(null);
      this.reason = '';
      this.notice.set(action === 'enable' ? 'Sign-in restored.' : (action === 'disable' ? 'Sign-in disabled. ' : '') + data.revoked + ' sessions revoked.');
      await this.refresh(row.id);
    });
  }
  private async refresh(id: number) {
    await this.loadIdentity(id);
    const page = this.page()?.page ?? 1;
    const result = await this.request(this.api.list(page, this.appliedSearch, this.disabledOnly));
    this.page.set(!result.data.length && page > 1
      ? await this.request(this.api.list(page - 1, this.appliedSearch, this.disabledOnly)) : result);
  }
  private async loadIdentity(id: number) {
    const result = await this.request(this.api.detail(id));
    this.selected.set(result);
    this.name = result.name;
  }
  private request<T>(stream: Observable<T>) {
    return firstValueFrom(stream.pipe(takeUntilDestroyed(this.destroy)));
  }
  private async run(task: () => Promise<void>) {
    if (this.busy()) return;
    const finish = this.pending.add();
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    try { await task(); }
    catch (error) { if (!this.destroy.destroyed) this.error.set(apiErrorMessage(error)); }
    finally { this.busy.set(false); finish(); }
  }
}
