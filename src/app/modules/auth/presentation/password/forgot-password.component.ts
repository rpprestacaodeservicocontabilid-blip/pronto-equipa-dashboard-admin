import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AccountService } from '../../application/account.service';
import { apiErrorMessage } from '../../../../core/api/api-error';
import { AuthFormFrameComponent } from '../components/auth-form-frame.component';
import { AuthInputDirective } from '../components/auth-input.directive';
@Component({
  selector: 'app-forgot-password', standalone: true,
  imports: [FormsModule, RouterLink, AuthFormFrameComponent, AuthInputDirective],
  templateUrl: './forgot-password.component.html',
})
export class ForgotPasswordComponent {
  private readonly api = inject(AccountService);
  email = ''; readonly busy = signal(false); readonly error = signal(''); readonly notice = signal('');
  async submit() {
    if (this.busy()) return;
    this.busy.set(true); this.error.set(''); this.notice.set('');
    try {
      await firstValueFrom(this.api.forgotPassword(this.email.trim()));
      this.notice.set('If this email is registered, password reset instructions will be sent.');
    } catch (error) { this.error.set(apiErrorMessage(error)); }
    finally { this.busy.set(false); }
  }
}

