import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService, LoginChallenge } from '../../../core/auth/auth.service';
import { apiErrorMessage } from '../../../core/api/api-error';
import { AuthPageLayoutComponent } from '../../../layout/shell/auth-page-layout/auth-page-layout.component';
import { SignInContentComponent } from '../../../shared/components/full-width-pages/auth/sign-in';
import { SignInFormData } from '../../../shared/components/full-width-pages/auth/sign-in/schema';
import { GoogleOAuthService } from '../../../modules/auth/infrastructure/google-oauth.service';
import { signInDestination } from '../../../modules/auth/presentation/authenticated.guard';
@Component({ selector: 'app-sign-in', standalone: true, imports: [FormsModule, AuthPageLayoutComponent, SignInContentComponent], templateUrl: './sign-in.component.html' })
export class SignInComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly google = inject(GoogleOAuthService);
  code = '';
  readonly challenge = signal<LoginChallenge | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = this.route.snapshot.queryParamMap.get('reason') === 'password-changed'
    ? 'Password changed. Sign in again with your new password.' : '';
  async onCredentials(data: SignInFormData) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      this.challenge.set(await firstValueFrom(this.auth.login(data.email.trim(), data.password)));
    } catch (error) {
      this.error.set(apiErrorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
  async submit() {
    const challenge = this.challenge();
    if (!challenge || this.busy()) return;
    this.busy.set(true); this.error.set('');
    try {
      await firstValueFrom(this.auth.verify(challenge.challengeId, this.code.trim()));
      this.code = '';
      await this.finishSignIn();
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
  restart() { this.challenge.set(null); this.code = ''; this.error.set(''); }
  async googleSignIn() {
    if (this.busy()) return;
    this.busy.set(true); this.error.set('');
    try {
      const code = await this.google.authorize();
      await firstValueFrom(this.auth.googleLogin(code));
      await this.finishSignIn();
    } catch (error) { this.error.set(apiErrorMessage(error)); }
    finally { this.busy.set(false); }
  }
  private finishSignIn() {
    const target = this.route.snapshot.queryParamMap.get('returnUrl');
    return this.router.navigateByUrl(signInDestination(target, this.auth.homeUrl), { replaceUrl: true });
  }
}
