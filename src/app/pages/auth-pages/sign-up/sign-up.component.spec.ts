import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { SignUpComponent } from './sign-up.component';
import { AccountService } from '../../../modules/auth/application/account.service';
import { AuthService } from '../../../modules/auth/application/auth.service';
import { GoogleOAuthService } from '../../../modules/auth/infrastructure/google-oauth.service';

describe('Account registration integration', () => {
  it('maps the template fields to the API contract and opens email verification without granting admin access', async () => {
    const register = jasmine.createSpy('register').and.returnValue(of({ email: 'client@example.com', verificationChallengeId: 21 }));
    const navigate = jasmine.createSpy('navigate').and.resolveTo(true);
    TestBed.configureTestingModule({ providers: [
      { provide: AccountService, useValue: { register } },
      { provide: Router, useValue: { navigate } },
      { provide: AuthService, useValue: {} },
      { provide: GoogleOAuthService, useValue: { enabled: false } },
    ] });
    const component = TestBed.runInInjectionContext(() => new SignUpComponent());
    await component.register({ fname: ' Ana ', lname: ' Silva ', email: ' client@example.com ', phone: '+244923456789',
      password: 'example-password', confirmPassword: 'example-password', terms: true });
    expect(register).toHaveBeenCalledOnceWith({ name: 'Ana Silva', email: 'client@example.com', phone: '+244923456789',
      password: 'example-password', confirmPassword: 'example-password', acceptTerms: true });
    expect(navigate).toHaveBeenCalledOnceWith(['/verify-email'], { queryParams: { email: 'client@example.com', challengeId: 21 } });
    expect(component.busy()).toBeFalse();
  });
});
