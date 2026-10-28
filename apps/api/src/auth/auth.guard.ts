import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@little-ants/db';
import { IS_PUBLIC, REQUIRED_ROLES, type AuthedRequest } from './decorators.js';
import { SessionResolver } from './session-resolver.js';
import { hasRole, isStaff } from './staff-access.js';

/** Every route needs a signed-in, active staff user unless marked @Public(). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionResolver,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const user = await this.sessions.resolve(request);
    if (!user) throw new UnauthorizedException('Sign in required');
    // An account without any HQ or school role (e.g. an invite that was not applied) can do nothing.
    if (!isStaff(user)) throw new ForbiddenException('Your account has no role yet. Ask an admin.');
    request.user = user;

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(REQUIRED_ROLES, targets);
    if (roles?.length && !hasRole(user, 'ADMIN', ...roles)) {
      throw new ForbiddenException('You do not have permission for this action');
    }
    return true;
  }
}
