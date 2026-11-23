import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';

@Injectable({ providedIn: 'root' })
export class AuditPurpose {
  private readonly auth = inject(AuthService);
  private readonly identity = computed(() => {
    const claims = this.auth.claims();
    return claims ? claims.sub + '/' + claims.sessionId : '';
  });
  private readonly entry = signal({ identity: '', purpose: '' });
  readonly current = computed(() => {
    const entry = this.entry();
    return entry.identity && entry.purpose && this.identity() === entry.identity ? entry : null;
  });
  readonly value = computed(() => this.current()?.purpose ?? '');
  set(purpose: string) {
    this.entry.set({ identity: this.identity(), purpose: purpose.trim() });
  }
}
