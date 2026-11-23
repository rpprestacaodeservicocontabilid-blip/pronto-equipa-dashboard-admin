import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { SupportCompany } from '../domain/support.models';

@Injectable({ providedIn: 'root' })
export class SupportWorkspace {
  private readonly auth = inject(AuthService);
  private readonly identity = computed(() => {
    const claims = this.auth.claims();
    return claims ? claims.sub + '/' + claims.sessionId : '';
  });
  private readonly entry = signal<{ identity: string; company: SupportCompany } | null>(null);
  readonly company = computed(() => {
    const entry = this.entry();
    return entry?.identity && entry.identity === this.identity() ? entry.company : null;
  });
  choose(company: SupportCompany) { this.entry.set({ identity: this.identity(), company }); }
}
