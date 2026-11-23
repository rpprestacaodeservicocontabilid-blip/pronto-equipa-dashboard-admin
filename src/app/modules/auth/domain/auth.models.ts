export interface RegisterInput {
  name: string; email: string; phone: string; password: string;
  confirmPassword: string; acceptTerms: boolean;
}
export interface RegisterResult {
  accountId: number; userId: number; email: string; phone: string; status: string;
  role: string; verificationChallengeId?: number;
}
export interface LoginChallenge {
  otpRequired: true; challengeId: number; destination: string; expiresAt: string;
}
export interface AuthTokens {
  accessToken: string; refreshToken?: string;
  accessTokenExpiresAt?: string; refreshTokenExpiresAt?: string;
}
export interface AuthClaims {
  sub: string; sessionId: string; roles: string[]; permissions: string[]; exp: number; type: string;
}
export type VerifyEmailInput = { token: string } | { challengeId: number; code: string };
export interface VerificationResult { success: boolean; challengeId?: number; }
export interface PasswordResetInput { token: string; newPassword: string; confirmPassword: string; }
export interface PasswordChangeInput { currentPassword: string; newPassword: string; }
export interface AuthSession {
  sessionId: number; userId: number; authAccountId: number;
  status: string; createdAt: string; expiresAt: string;
}
