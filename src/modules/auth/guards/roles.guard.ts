import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { AuthPermissionDeniedError } from '../errors/auth.error.js';
import { AuthService } from '../services/auth.service.js';
import type { AuthenticatedRequest } from './firebase-auth.guard.js';
import type { UserRole } from '../types/auth-user.type.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!roles || roles.length === 0) return true;
    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (!user) throw new AuthPermissionDeniedError();
    this.authService.assertRoles(user, roles);
    return true;
  }
}
