import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Role } from '@little-ants/db';
import type { StaffUser } from './staff-access.js';

export const IS_PUBLIC = 'isPublic';
export const REQUIRED_ROLES = 'requiredRoles';

/** Route needs no sign-in. */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC, true);

/** Route needs one of these roles (ADMIN always passes). */
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator => SetMetadata(REQUIRED_ROLES, roles);

export interface AuthedRequest {
  user?: StaffUser;
  headers: Record<string, string | string[] | undefined>;
}

/** The signed-in staff user (set by AuthGuard). */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): StaffUser => {
  const request = context.switchToHttp().getRequest<AuthedRequest>();
  if (!request.user) throw new Error('CurrentUser used on a public route');
  return request.user;
});
