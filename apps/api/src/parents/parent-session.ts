import {
  createParamDecorator,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import { PARENT_COOKIE, ParentAuthService } from './parent-auth.service.js';

export interface SignedInParent {
  parentId: string;
  sessionId: string;
}

type ParentRequest = Request & { parent?: SignedInParent };

/** One cookie from the Cookie header (no cookie parser is installed; Better Auth reads its own). */
export function readCookie(request: Request, name: string): string | undefined {
  for (const part of (request.headers.cookie ?? '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key !== name) continue;
    try {
      return decodeURIComponent(value.join('='));
    } catch {
      return undefined; // a mangled cookie is no session
    }
  }
  return undefined;
}

/** Parent routes need a parent session (staff sessions do not count). */
@Injectable()
export class ParentGuard implements CanActivate {
  constructor(private readonly auth: ParentAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ParentRequest>();
    const parent = await this.auth.resolve(readCookie(request, PARENT_COOKIE));
    if (!parent) throw new UnauthorizedException('Sign in required');
    request.parent = parent;
    return true;
  }
}

export const CurrentParent = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SignedInParent => {
    const request = context.switchToHttp().getRequest<ParentRequest>();
    if (!request.parent) throw new Error('CurrentParent used without ParentGuard');
    return request.parent;
  },
);
