import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { FirebaseAuthService } from '../../../integrations/firebase/firebase-auth.service.js';
import { AuthService } from '../services/auth.service.js';
import type { AuthenticatedUser } from '../types/auth-user.type.js';

export type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(private readonly firebase: FirebaseAuthService, private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request.headers.authorization);
    if (!token) throw new UnauthorizedException({ error: 'AUTH_TOKEN_REQUIRED', message: 'A Firebase ID token is required' });
    request.user = await this.authService.resolveAuthenticatedUser(await this.firebase.verifyIdToken(token));
    return true;
  }

  private extractBearerToken(header: string | undefined): string | null {
    if (!header) return null;
    const [scheme, token] = header.split(' ');
    return scheme === 'Bearer' && token ? token : null;
  }
}
