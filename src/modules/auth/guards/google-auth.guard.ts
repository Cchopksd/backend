import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { FirebaseAuthService } from '../../../integrations/firebase/firebase-auth.service.js';
import { AuthService } from '../services/auth.service.js';
import type { AuthenticatedRequest } from './firebase-auth.guard.js';

@Injectable()
export class GoogleAuthGuard implements CanActivate {
  constructor(private readonly firebase: FirebaseAuthService, private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    const [scheme, idToken] = header?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !idToken) throw new UnauthorizedException({ error: 'AUTH_TOKEN_REQUIRED', message: 'A Firebase ID token is required' });
    request.user = await this.authService.resolveGoogleUser(await this.firebase.verifyIdToken(idToken));
    return true;
  }
}
