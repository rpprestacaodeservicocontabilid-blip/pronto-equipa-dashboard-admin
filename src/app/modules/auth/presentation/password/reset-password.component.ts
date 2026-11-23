import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AccountService } from '../../application/account.service';
import { AuthService } from '../../application/auth.service';
import { apiErrorMessage } from '../../../../core/api/api-error';
import { AuthFormFrameComponent } from '../components/auth-form-frame.component';
import { AuthInputDirective } from '../components/auth-input.directive';
@Component({
  selector: 'app-reset-password', standalone: true,
  imports: [FormsModule, RouterLink, AuthFormFrameComponent, AuthInputDirective],
  templateUrl: './reset-password.component.html',
})
export class ResetPasswordComponent {
  private readonly api = inject(AccountService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  token = this.route.snapshot.queryParamMap.get('token') || '';
  password = ''; confirm = '';
  readonly busy = signal(false); readonly done = signal(false); readonly error = signal(''); readonly notice = signal('');
  constructor() {
    if (this.token) window.history.replaceState(null, '', window.location.pathname);
  }
  async submit() {
    if (this.busy()) return;
    this.error.set('');
    if (this.password !== this.confirm) { this.error.set('Passwords do not match.'); return; }
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.resetPassword({ token: this.token.trim(), newPassword: this.password, confirmPassword: this.confirm }));
      this.password = ''; this.confirm = ''; this.token = '';
      this.done.set(true); this.notice.set('Your password has been reset. Sign in with the new password.');
      // Do not retain credentials that were issued before the password reset.
      if (this.auth.tokens()) this.auth.clear();
    } catch (error) { this.error.set(apiErrorMessage(error)); }
    finally { this.busy.set(false); }
  }
}

