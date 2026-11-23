import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AccountService } from '../../application/account.service';
import { apiErrorMessage } from '../../../../core/api/api-error';
import { AuthFormFrameComponent } from '../components/auth-form-frame.component';
import { AuthInputDirective } from '../components/auth-input.directive';
@Component({
  selector: 'app-verify-email', standalone: true,
  imports: [FormsModule, RouterLink, AuthFormFrameComponent, AuthInputDirective],
  templateUrl: './verify-email.component.html',
})
export class VerifyEmailComponent {
  private readonly api = inject(AccountService);
  private readonly route = inject(ActivatedRoute);
  private readonly params = this.route.snapshot.queryParamMap;
  email = this.params.get('email') || '';
  challengeId: number | null = Number(this.params.get('challengeId')) || null;
  token = this.params.get('token') || ''; code = ''; mode = this.token ? 'token' : 'code';
  readonly busy = signal(false); readonly done = signal(false); readonly error = signal(''); readonly notice = signal('');
  constructor() { window.history.replaceState(null, '', window.location.pathname); }
  async verify() {
    if (this.busy()) return;
    this.busy.set(true); this.error.set(''); this.notice.set('');
    try {
      if (this.mode === 'code' && (!Number.isSafeInteger(this.challengeId) || !this.challengeId || this.challengeId < 1)) throw new Error('Enter a valid challenge ID.');
      await firstValueFrom(this.api.verifyEmail(this.mode === 'token' ? { token: this.token.trim() } : { challengeId: this.challengeId!, code: this.code.trim() }));
      this.done.set(true); this.token = ''; this.code = ''; this.notice.set('Email verified. You can now sign in.');
    } catch (error) { this.error.set(apiErrorMessage(error)); }
    finally { this.busy.set(false); }
  }
  async resend() {
    if (this.busy()) return;
    this.busy.set(true); this.error.set(''); this.notice.set('');
    try {
      const result = await firstValueFrom(this.api.resendVerification(this.email.trim()));
      this.challengeId = result.challengeId || null; this.code = ''; this.mode = 'code';
      this.notice.set('If verification is required for this email, new instructions will be sent.');
    } catch (error) { this.error.set(apiErrorMessage(error)); }
    finally { this.busy.set(false); }
  }
}

