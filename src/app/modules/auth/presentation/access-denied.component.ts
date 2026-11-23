import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthFormFrameComponent } from './components/auth-form-frame.component';
import { AuthService } from '../application/auth.service';
import { apiErrorMessage } from '../../../core/api/api-error';
import { signInDestination } from './authenticated.guard';

const messages = {
  companies: {
    title: 'Platform access required',
    description: 'Managing client companies requires the SUPER_ADMIN role.',
  },
  payments: {
    title: 'Payments access required',
    description: 'Your account needs a platform Payments permission for this page.',
  },
  'legal-rules': {
    title: 'Legal rules access required',
    description: 'Your account needs a platform Legal rules permission for this page.',
  },
  'platform-billing': {
    title: 'Platform billing access required',
    description: 'Managing platform billing requires the SUPER_ADMIN role.',
  },
  onboarding: {
    title: 'Onboarding access required',
    description: 'Managing platform onboarding requires the SUPER_ADMIN role.',
  },
  payslips: {
    title: 'Payslip supervision access required',
    description: 'Platform payslip supervision requires the SUPER_ADMIN role.',
  },
  reports: {
    title: 'Platform reports access required',
    description: 'Managing platform reports requires the SUPER_ADMIN role.',
  },
};

@Component({
  selector: 'app-access-denied', standalone: true, imports: [AuthFormFrameComponent, RouterLink],
  template: `<app-auth-form-frame [title]="message().title" [description]="message().description">
    @if (auth.claims(); as account) {
      <p class="mb-4 text-sm text-gray-600 dark:text-gray-400">
        Signed in as account #{{ account.sub }}{{ auth.isPlatformAdmin() ? ' · Platform super-admin' : '' }}
      </p>
      <a routerLink="/account/security" class="mb-5 block text-sm text-brand-500 dark:text-brand-400">Account security</a>
      @if (error()) { <p role="alert" class="mb-3 text-sm text-error-700 dark:text-error-400">{{ error() }}</p> }
      <button type="button" (click)="signOut()" [disabled]="busy()"
        class="h-11 w-full rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 dark:hover:bg-brand-400">
        {{ busy() ? 'Signing out…' : 'Sign in with another account' }}
      </button>
    } @else {
      <a routerLink="/signin" [queryParams]="{ returnUrl: returnUrl() }" class="text-sm text-brand-600 dark:text-brand-400">Sign in</a>
    }
  </app-auth-form-frame>`,
})
export class AccessDeniedComponent {
  protected readonly auth = inject(AuthService);
  private readonly query = toSignal(inject(ActivatedRoute).queryParamMap, { requireSync: true });
  protected readonly returnUrl = computed(() => signInDestination(this.query().get('returnUrl'), this.auth.homeUrl));
  protected readonly message = computed(() => {
    const area = this.query().get('area');
    return area && Object.hasOwn(messages, area) ? messages[area as keyof typeof messages] : {
      title: 'Access required', description: 'Contact your platform administrator to request access to this page.',
    };
  });
  protected readonly error = signal('');
  protected readonly busy = signal(false);

  protected async signOut() {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try { await firstValueFrom(this.auth.logout(this.returnUrl())); }
    catch (error) { this.error.set(apiErrorMessage(error)); }
    finally { this.busy.set(false); }
  }
}
