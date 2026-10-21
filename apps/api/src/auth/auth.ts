import type { PrismaClient } from '@little-ants/db';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { APIError } from 'better-auth/api';
import type { Env } from '../config/env.js';
import { DeactivatedError, NotInvitedError, acceptInvite, assertActive, assertInvited } from './staff-access.js';

/** Better Auth instance: Google sign-in for invited staff, optional password sign-in in development. */
export function createAuth(prisma: PrismaClient, env: Env) {
  return betterAuth({
    appName: 'Little Ants',
    baseURL: env.API_PUBLIC_URL,
    basePath: '/api/auth',
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: env.CORS_ORIGINS,
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    emailAndPassword: {
      enabled: env.AUTH_DEV_PASSWORD_LOGIN,
      disableSignUp: false,
    },
    socialProviders: env.googleEnabled
      ? { google: { clientId: env.GOOGLE_CLIENT_ID!, clientSecret: env.GOOGLE_CLIENT_SECRET!, prompt: 'select_account' } }
      : {},
    session: {
      expiresIn: 60 * 60 * 24 * 30, // teachers stay signed in on classroom devices for a month
      updateAge: 60 * 60 * 24,
    },
    advanced: {
      useSecureCookies: env.NODE_ENV === 'production',
      // Behind Cloudflare the real client address is in CF-Connecting-IP (X-Forwarded-For can be spoofed).
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
      crossSubDomainCookies: env.AUTH_COOKIE_DOMAIN ? { enabled: true, domain: env.AUTH_COOKIE_DOMAIN } : undefined,
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            try {
              await assertInvited(prisma, user.email);
            } catch (error) {
              if (error instanceof NotInvitedError) throw new APIError('FORBIDDEN', { message: 'not_invited' });
              throw error;
            }
            return { data: { ...user, email: user.email.toLowerCase() } };
          },
          after: async (user) => {
            await acceptInvite(prisma, user.id, user.email);
          },
        },
      },
      session: {
        create: {
          before: async (session) => {
            try {
              await assertActive(prisma, session.userId);
            } catch (error) {
              if (error instanceof DeactivatedError) throw new APIError('FORBIDDEN', { message: 'deactivated' });
              throw error;
            }
          },
          after: async (session) => {
            await prisma.auditLog.create({
              data: { actorId: session.userId, action: 'sign-in', details: { userAgent: session.userAgent ?? '' } },
            });
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
