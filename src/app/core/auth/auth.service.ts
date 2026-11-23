// Compatibility entry point for core consumers. Authentication belongs to modules/auth.
export { AuthService } from '../../modules/auth/application/auth.service';
export type { AuthTokens, LoginChallenge } from '../../modules/auth/domain/auth.models';
