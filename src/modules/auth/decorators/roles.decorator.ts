import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '../types/auth-user.type.js';

export const ROLES_KEY = 'auth:roles';
export const Roles = (...roles: UserRole[]): ReturnType<typeof SetMetadata> => SetMetadata(ROLES_KEY, roles);
