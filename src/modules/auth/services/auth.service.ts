import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { FirebaseAuthService } from '../../../integrations/firebase/firebase-auth.service.js';
import type { VerifiedFirebaseToken } from '../../../integrations/firebase/types/firebase-user.type.js';
import { RedisService } from '../../../infrastructure/cache/redis.service.js';
import { AuthPermissionDeniedError, AuthSignInRateLimitedError, OtpExpiredError, OtpInvalidError, OtpRateLimitedError, OtpResendCooldownError } from '../errors/auth.error.js';
import { AuthRepository } from '../repositories/auth.repository.js';
import type { AuthenticatedUser } from '../types/auth-user.type.js';
import { EMAIL_OTP_SENDER, type EmailOtpSender } from './email-otp-sender.service.js';
import { OtpCryptoService } from './otp-crypto.service.js';
import { SessionService } from './session.service.js';

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const REQUEST_LIMIT = 5;
const REQUEST_WINDOW_SECONDS = 15 * 60;
const MAX_ATTEMPTS = 5;
const PASSWORD_SIGN_IN_LIMIT = 10;
const PASSWORD_SIGN_IN_WINDOW_SECONDS = 15 * 60;

@Injectable()
export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly firebase: FirebaseAuthService,
    private readonly redis: RedisService,
    private readonly otpCrypto: OtpCryptoService,
    @Inject(EMAIL_OTP_SENDER) private readonly emailSender: EmailOtpSender,
    private readonly sessions: SessionService,
  ) {}

  async requestEmailOtp(emailInput: string, ip: string): Promise<{ challengeId: string; expiresAt: Date }> {
    const email = this.normalizeEmail(emailInput);
    await this.enforceRequestRateLimit(email, ip);
    const latest = await this.repository.findLatestActiveChallenge(email);
    if (latest && Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS) throw new OtpResendCooldownError();
    const code = this.otpCrypto.generateCode();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    const challenge = await this.repository.replaceChallenge({ email, codeHash: await this.otpCrypto.hash(code), expiresAt });
    try {
      await this.emailSender.sendOtp({ email, code, expiresAt });
    } catch (error: unknown) {
      await this.repository.invalidateChallenge(challenge.id);
      throw error;
    }
    return { challengeId: challenge.id, expiresAt };
  }

  async verifyEmailOtp(challengeId: string, code: string): Promise<{ customToken: string; user: AuthenticatedUser }> {
    const email = await this.repository.withLockedChallenge(challengeId, async (challenge, commands) => {
      if (challenge.usedAt || challenge.expiresAt.getTime() <= Date.now()) throw new OtpExpiredError();
      if (challenge.attempts >= MAX_ATTEMPTS) throw new OtpRateLimitedError();
      if (!(await this.otpCrypto.verify(code, challenge.codeHash))) {
        await commands.incrementAttempts();
        throw new OtpInvalidError();
      }
      await commands.markUsed();
      return challenge.email;
    });
    if (!email) throw new OtpInvalidError();
    const firebaseUser = await this.firebase.getOrCreateUserByVerifiedEmail(email);
    const user = await this.repository.upsertUser({ firebaseUid: firebaseUser.uid, email, displayName: firebaseUser.displayName });
    return { customToken: await this.firebase.createCustomToken(firebaseUser.uid), user };
  }

  async signInWithEmailPassword(emailInput: string, password: string, ip: string): Promise<{ customToken: string; user: AuthenticatedUser }> {
    const email = this.normalizeEmail(emailInput);
    await this.enforcePasswordSignInRateLimit(email, ip);
    const idToken = await this.firebase.signInWithEmailAndPassword(email, password);
    const token = await this.firebase.verifyIdToken(idToken);
    if (!token.email || !token.emailVerified) {
      throw new UnauthorizedException({ error: 'AUTH_INVALID_CREDENTIALS', message: 'Invalid email or password' });
    }
    const user = await this.repository.upsertUser({ firebaseUid: token.uid, email: this.normalizeEmail(token.email), displayName: token.displayName });
    return { customToken: await this.firebase.createCustomToken(token.uid), user };
  }

  async resolveGoogleUser(token: VerifiedFirebaseToken): Promise<AuthenticatedUser> {
    if (token.signInProvider !== 'google.com' || !token.email || !token.emailVerified) {
      throw new UnauthorizedException({ error: 'AUTH_GOOGLE_TOKEN_REQUIRED', message: 'A verified Google Firebase token is required' });
    }
    return this.repository.upsertUser({ firebaseUid: token.uid, email: this.normalizeEmail(token.email), displayName: token.displayName });
  }

  async resolveAuthenticatedUser(token: VerifiedFirebaseToken): Promise<AuthenticatedUser> {
    const user = await this.repository.findUserByFirebaseUid(token.uid);
    if (!user) throw new UnauthorizedException({ error: 'AUTH_PROFILE_NOT_FOUND', message: 'No local profile exists for this identity' });
    return user;
  }

  async resolveAccessToken(accessToken: string): Promise<AuthenticatedUser> {
    const payload = await this.sessions.validateAccess(accessToken);
    const user = await this.repository.findUserById(payload.sub);
    if (!user || user.role !== payload.role) throw new UnauthorizedException({ error: 'AUTH_SESSION_INVALID', message: 'Your session is no longer valid' });
    return user;
  }

  assertRoles(user: AuthenticatedUser, permittedRoles: readonly string[]): void {
    if (!permittedRoles.includes(user.role)) throw new AuthPermissionDeniedError();
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLocaleLowerCase('en-US');
  }

  private async enforceRequestRateLimit(email: string, ip: string): Promise<void> {
    const redis = this.redis.getClient();
    for (const key of [`auth:otp:email:${email}`, `auth:otp:ip:${ip}`]) {
      const current = await redis.incr(key);
      if (current === 1) await redis.expire(key, REQUEST_WINDOW_SECONDS);
      if (current > REQUEST_LIMIT) throw new OtpRateLimitedError();
    }
  }

  private async enforcePasswordSignInRateLimit(email: string, ip: string): Promise<void> {
    const redis = this.redis.getClient();
    for (const key of [`auth:password:email:${email}`, `auth:password:ip:${ip}`]) {
      const current = await redis.incr(key);
      if (current === 1) await redis.expire(key, PASSWORD_SIGN_IN_WINDOW_SECONDS);
      if (current > PASSWORD_SIGN_IN_LIMIT) throw new AuthSignInRateLimitedError();
    }
  }
}
