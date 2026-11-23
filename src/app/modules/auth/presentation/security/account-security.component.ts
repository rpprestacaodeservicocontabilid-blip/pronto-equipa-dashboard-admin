import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { AccountService } from '../../application/account.service';
import { AuthService } from '../../application/auth.service';
import { AuthSession } from '../../domain/auth.models';
import { GoogleOAuthService } from '../../infrastructure/google-oauth.service';
import { apiErrorMessage } from '../../../../core/api/api-error';
import { PageBreadcrumbComponent } from '../../../../shared/components/common/page-breadcrumb/page-breadcrumb.component';
import { ComponentCardComponent } from '../../../../shared/components/common/component-card/component-card.component';
import { AuthInputDirective } from '../components/auth-input.directive';
type SecurityAction = 'current' | 'other' | 'unlink';
@Component({
  selector: 'app-account-security', standalone: true,
  imports: [FormsModule, DatePipe, PageBreadcrumbComponent, ComponentCardComponent, AuthInputDirective],
  templateUrl: './account-security.component.html',
})
export class AccountSecurityComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly account = inject(AccountService);
  readonly google = inject(GoogleOAuthService);
  readonly session = signal<AuthSession | null>(null);
  readonly busy = signal(false); readonly error = signal(''); readonly notice = signal('');
  readonly pending = signal<SecurityAction | null>(null);
  currentPassword = ''; newPassword = ''; confirmPassword = '';
  permission = '';
  readonly permissionResult = signal<string | null>(null);
  ngOnInit() { void this.load(); }
  private async run(action: () => Promise<void>) {
    if (this.busy()) return;
    this.busy.set(true); this.error.set(''); this.notice.set('');
    try { await action(); }
    catch (error) { this.error.set(apiErrorMessage(error)); }
    finally { this.busy.set(false); }
  }
  load() { return this.run(async () => { this.session.set(await firstValueFrom(this.account.currentSession())); }); }
  changePassword() {
    return this.run(async () => {
      if (this.newPassword !== this.confirmPassword) throw new Error('Passwords do not match.');
      await firstValueFrom(this.auth.changePassword({ currentPassword: this.currentPassword, newPassword: this.newPassword }));
      this.currentPassword = ''; this.newPassword = ''; this.confirmPassword = '';
    });
  }
  confirmAction() {
    const action = this.pending();
    if (!action) return Promise.resolve();
    return this.run(async () => {
      if (action === 'current') {
        const id = this.session()?.sessionId;
        if (!id) throw new Error('Refresh the current session first.');
        await firstValueFrom(this.auth.revokeSession(id));
      } else if (action === 'other') {
        await firstValueFrom(this.account.revokeOtherSessions());
        this.notice.set('All other sessions have been revoked. This session remains active.');
      } else {
        await firstValueFrom(this.account.unlinkGoogle());
        this.notice.set('Google account disconnected.');
      }
      this.pending.set(null);
    });
  }
  linkGoogle() {
    return this.run(async () => {
      const code = await this.google.authorize();
      await firstValueFrom(this.account.linkGoogle(code));
      this.notice.set('Google account connected.');
    });
  }
  checkPermission() {
    this.permissionResult.set(null);
    return this.run(async () => {
      const permission = this.permission.trim();
      const result = await firstValueFrom(this.account.checkPermission(Number(this.auth.claims()!.sub), permission));
      this.permissionResult.set(`${permission}: ${result.allowed ? 'Allowed' : 'Not allowed'}`);
    });
  }
}
