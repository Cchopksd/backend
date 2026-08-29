import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { AuthRepository } from '../repositories/auth.repository.js';
import type { AuthenticatedUser } from '../types/auth-user.type.js';

const ACCESS_TOKEN_TTL = 15 * 60;
const REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
type TokenPayload = { sub: string; sid: string; jti: string; role: AuthenticatedUser['role']; type: 'access' | 'refresh' };

@Injectable()
export class SessionService {
  constructor(private readonly jwt: JwtService, private readonly config: ConfigService, private readonly repository: AuthRepository) {}

  async create(user: AuthenticatedUser): Promise<{ accessToken: string; refreshToken: string }> {
    const sessionId = randomUUID();
    const refreshToken = await this.sign({ sub: user.id, sid: sessionId, jti: randomUUID(), role: user.role, type: 'refresh' }, this.refreshSecret, REFRESH_TOKEN_TTL);
    await this.repository.createSession({ id: sessionId, userId: user.id, refreshTokenHash: this.hash(refreshToken), expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS) });
    return { accessToken: await this.sign({ sub: user.id, sid: sessionId, jti: randomUUID(), role: user.role, type: 'access' }, this.accessSecret, ACCESS_TOKEN_TTL), refreshToken };
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = await this.verify(refreshToken, this.refreshSecret, 'refresh');
    const session = await this.repository.getActiveSession(payload.sid);
    if (!session || session.userId !== payload.sub || !this.sameHash(session.refreshTokenHash, this.hash(refreshToken))) throw this.invalidToken();
    const newRefreshToken = await this.sign({ ...payload, jti: randomUUID() }, this.refreshSecret, REFRESH_TOKEN_TTL);
    await this.repository.rotateSession(payload.sid, this.hash(newRefreshToken));
    return { accessToken: await this.sign({ ...payload, type: 'access' }, this.accessSecret, ACCESS_TOKEN_TTL), refreshToken: newRefreshToken };
  }

  async validateAccess(accessToken: string): Promise<TokenPayload> {
    const payload = await this.verify(accessToken, this.accessSecret, 'access');
    if (!(await this.repository.getActiveSession(payload.sid))) throw this.invalidToken();
    return payload;
  }

  async revoke(refreshToken: string): Promise<void> {
    try { const payload = await this.verify(refreshToken, this.refreshSecret, 'refresh'); await this.repository.revokeSession(payload.sid); } catch { return; }
  }

  private async sign(payload: TokenPayload, secret: string, expiresIn: number): Promise<string> { return this.jwt.signAsync(payload, { secret, expiresIn }); }
  private async verify(token: string, secret: string, expectedType: TokenPayload['type']): Promise<TokenPayload> { try { const payload = await this.jwt.verifyAsync<TokenPayload>(token, { secret }); if (payload.type !== expectedType || !payload.sub || !payload.sid) throw this.invalidToken(); return payload; } catch { throw this.invalidToken(); } }
  private hash(value: string): string { return createHash('sha256').update(value).digest('base64url'); }
  private sameHash(left: string, right: string): boolean { const a = Buffer.from(left); const b = Buffer.from(right); return a.length === b.length && timingSafeEqual(a, b); }
  private invalidToken(): UnauthorizedException { return new UnauthorizedException({ error: 'AUTH_SESSION_INVALID', message: 'Your session is no longer valid' }); }
  private get accessSecret(): string { return this.config.getOrThrow<string>('auth.accessTokenSecret'); }
  private get refreshSecret(): string { return this.config.getOrThrow<string>('auth.refreshTokenSecret'); }
}
