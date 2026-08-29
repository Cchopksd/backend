import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../services/auth.service.js';
import type { AuthenticatedRequest } from './firebase-auth.guard.js';

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException({ error: 'AUTH_TOKEN_REQUIRED', message: 'An access token is required' });
    request.user = await this.authService.resolveAccessToken(token);
    return true;
  }
}
