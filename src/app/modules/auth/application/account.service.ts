import { Injectable, inject } from '@angular/core';
import { AuthApiService } from '../infrastructure/auth-api.service';
import { RegisterInput, VerifyEmailInput, PasswordResetInput } from '../domain/auth.models';
@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly api = inject(AuthApiService);
  register(input: RegisterInput) { return this.api.register(input); }
  verifyEmail(input: VerifyEmailInput) { return this.api.verifyEmail(input); }
  resendVerification(email: string) { return this.api.resendVerification(email); }
  forgotPassword(email: string) { return this.api.forgotPassword(email); }
  resetPassword(input: PasswordResetInput) { return this.api.resetPassword(input); }
  currentSession() { return this.api.currentSession(); }
  revokeOtherSessions() { return this.api.revokeOtherSessions(); }
  linkGoogle(code: string) { return this.api.linkGoogle(code); }
  unlinkGoogle() { return this.api.unlinkGoogle(); }
  checkPermission(userId: number, permission: string, companyId?: number) { return this.api.checkPermission(userId, permission, companyId); }
}
