import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { NotificationsApi } from '../infrastructure/notifications-api.service';

@Injectable({ providedIn: 'root' })
export class NotificationInbox {
  private readonly auth = inject(AuthService);
  private readonly api = inject(NotificationsApi);
  readonly identity = computed(() => {
    const claims = this.auth.claims();
    return claims ? claims.sub + '/' + claims.sessionId : '';
  });
  private readonly selection = signal({ identity: '', company: null as number | null });
  private readonly badge = signal({ key: '', count: 0 });
  private revision = 0;
  readonly company = computed(() => this.selection().identity === this.identity() ? this.selection().company : null);
  private readonly key = computed(() => this.identity() + ':' + (this.company() ?? 'platform'));
  readonly count = computed(() => this.badge().key === this.key() ? this.badge().count : 0);

  select(company: number | null) {
    if (this.selection().identity === this.identity() && this.company() === company) return;
    this.selection.set({ identity: this.identity(), company });
    this.badge.set({ key: this.key(), count: 0 });
    this.revision++;
  }

  refresh() {
    if (!this.identity()) return;
    const key = this.key();
    const revision = ++this.revision;
    this.api.unread(this.company()).subscribe({
      next: result => { if (key === this.key() && revision === this.revision) this.badge.set({ key, count: result.count }); },
      error: () => { if (key === this.key() && revision === this.revision) this.badge.set({ key, count: 0 }); },
    });
  }
}
