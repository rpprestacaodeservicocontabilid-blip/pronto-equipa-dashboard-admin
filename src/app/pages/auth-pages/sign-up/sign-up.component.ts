import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import SignUpContentComponent from '../../../shared/components/full-width-pages/auth/sign-up';
import { SignUpFormData } from '../../../shared/components/full-width-pages/auth/sign-up/schema';
import { AuthPageLayoutComponent } from '../../../layout/shell/auth-page-layout/auth-page-layout.component';
import { AccountService } from '../../../modules/auth/application/account.service';
import { GoogleOAuthService } from '../../../modules/auth/infrastructure/google-oauth.service';
import { AuthService } from '../../../modules/auth/application/auth.service';
import { apiErrorMessage } from '../../../core/api/api-error';
@Component({
  selector: 'app-sign-up', standalone: true,
  imports: [AuthPageLayoutComponent, SignUpContentComponent], templateUrl: './sign-up.component.html',
})
export class SignUpComponent {
  private readonly api = inject(AccountService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly google = inject(GoogleOAuthService);
  readonly busy = signal(false); readonly error = signal('');
  async register(data: SignUpFormData) {
    if (this.busy()) return;
    this.busy.set(true); this.error.set('');
    try {
      const result = await firstValueFrom(this.api.register({
        name: `${data.fname.trim()} ${data.lname.trim()}`.trim(), email: data.email.trim(),
        phone: data.phone.trim(), password: data.password, confirmPassword: data.confirmPassword,
        acceptTerms: data.terms,
      }));
      await this.router.navigate(['/verify-email'], { queryParams: { email: result.email, challengeId: result.verificationChallengeId } });
    } catch (error) { this.error.set(apiErrorMessage(error)); }
    finally { this.busy.set(false); }
  }
  async googleSignUp() {
    if (this.busy()) return;
    this.busy.set(true); this.error.set('');
    try {
      const code = await this.google.authorize();
      await firstValueFrom(this.auth.googleLogin(code));
      await this.router.navigateByUrl(this.auth.homeUrl);
    } catch (error) { this.error.set(apiErrorMessage(error)); }
    finally { this.busy.set(false); }
  }
}
