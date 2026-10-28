import { Inject, Injectable } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Auth } from './auth.js';
import type { AuthedRequest } from './decorators.js';
import { loadStaffUser, type StaffUser } from './staff-access.js';

export const AUTH = Symbol('AUTH');

/** Finds the signed-in staff user for a request. Tests replace this provider. */
export abstract class SessionResolver {
  abstract resolve(request: AuthedRequest): Promise<StaffUser | null>;
}

@Injectable()
export class BetterAuthSessionResolver extends SessionResolver {
  constructor(
    @Inject(AUTH) private readonly auth: Auth,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async resolve(request: AuthedRequest): Promise<StaffUser | null> {
    const session = await this.auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
    if (!session) return null;
    return loadStaffUser(this.prisma.client, session.user.id);
  }
}
