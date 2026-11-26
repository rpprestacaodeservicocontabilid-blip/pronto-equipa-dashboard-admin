import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../application/auth.service';
import { signInDestination } from './authenticated.guard';

@Component({
  standalone: true,
  selector: 'app-session-unavailable',
  template: `
    <main class="grid min-h-screen place-items-center bg-gray-50 p-5 dark:bg-gray-900">
      <section class="w-full max-w-md space-y-4 rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-950">
        <h1 class="text-xl font-semibold text-gray-900 dark:text-white"><ng-container i18n="@@auth-message-29">Could not restore your session</ng-container></h1>
        <p class="text-sm text-gray-600 dark:text-gray-400"><ng-container i18n="@@auth-message-30">Check your connection and try again to return to the page you were opening.</ng-container></p>
        <button type="button" class="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50 dark:hover:bg-brand-400"
          [disabled]="busy()" (click)="retry()">@if (busy()) { <ng-container i18n="@@auth-message-31">Reconnecting…</ng-container> } @else { <ng-container i18n="@@auth-message-32">Try again</ng-container> }</button>
      </section>
    </main>
  `,
})
export class SessionUnavailableComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly busy = signal(false);

  protected async retry() {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.auth.restore();
      if (this.auth.sessionUnavailable()) return;
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
      if (this.auth.tokens()) {
        await this.router.navigateByUrl(signInDestination(returnUrl, this.auth.homeUrl), { replaceUrl: true });
      } else {
        await this.router.navigate(['/signin'], { queryParams: { returnUrl }, replaceUrl: true });
      }
    } finally {
      this.busy.set(false);
    }
  }
}
