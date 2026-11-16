import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService, LoginChallenge } from '../../../core/auth/auth.service';
import { apiErrorMessage } from '../../../core/api/api-error';
@Component({ selector: 'app-sign-in', standalone: true, imports: [FormsModule], templateUrl: './sign-in.component.html' })
export class SignInComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  identifier = ''; password = ''; code = '';
  readonly challenge = signal<LoginChallenge | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  async submit() {
    if (this.busy()) return;
    this.busy.set(true); this.error.set('');
    try {
      const challenge = this.challenge();
      if (challenge) {
        await firstValueFrom(this.auth.verify(challenge.challengeId, this.code.trim()));
        if (!this.auth.isPlatformAdmin()) {
          await firstValueFrom(this.auth.logout());
          this.error.set('This console requires the SUPER_ADMIN platform role.');
          this.restart();
          return;
        }
        await this.router.navigateByUrl('/');
      } else {
        this.challenge.set(await firstValueFrom(this.auth.login(this.identifier.trim(), this.password)));
        this.password = '';
      }
    } catch (error) { this.error.set(apiErrorMessage(error)); }
    finally { this.busy.set(false); }
  }
  async resend() {
    const challenge = this.challenge();
    if (!challenge || this.busy()) return;
    this.busy.set(true); this.error.set('');
    try {
      this.challenge.set(await firstValueFrom(this.auth.resend(challenge.challengeId)));
      this.code = '';
    }
    catch (error) { this.error.set(apiErrorMessage(error)); }
    finally { this.busy.set(false); }
  }
  restart() { this.challenge.set(null); this.code = ''; }
}
