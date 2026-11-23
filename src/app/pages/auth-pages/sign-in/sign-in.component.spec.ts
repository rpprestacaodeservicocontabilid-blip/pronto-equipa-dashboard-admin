import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { GoogleOAuthService } from '../../../modules/auth/infrastructure/google-oauth.service';
import { of } from 'rxjs';
import { AuthService, LoginChallenge } from '../../../core/auth/auth.service';
import { SignInComponent } from './sign-in.component';

describe('Platform sign in', () => {
  it('uses the replacement challenge after resending the OTP', async () => {
    const replacement: LoginChallenge = {
      otpRequired: true, challengeId: 42, destination: 'a***@example.com', expiresAt: '',
    };
    const resend = jasmine.createSpy('resend').and.returnValue(of(replacement));
    TestBed.configureTestingModule({ providers: [provideRouter([]),
    { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
    { provide: GoogleOAuthService, useValue: { enabled: false } }, {
      provide: AuthService, useValue: { resend },
    }] });
    const component = TestBed.runInInjectionContext(() => new SignInComponent());
    component.challenge.set({ ...replacement, challengeId: 41 });
    component.code = '123456';
    await component.resend();
    expect(resend).toHaveBeenCalledOnceWith(41);
    expect(component.challenge()?.challengeId).toBe(42);
    expect(component.code).toBe('');
    expect(component.busy()).toBeFalse();
  });
});
