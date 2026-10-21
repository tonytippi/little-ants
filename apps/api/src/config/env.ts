import path from 'node:path';
import { config } from 'dotenv';
import { z } from 'zod';
import { parseEnv } from '@little-ants/shared';

/** Repository root (apps/api/src/config → ../../../..). */
export const REPO_ROOT = path.resolve(import.meta.dirname, '../../../..');

// Local development keeps one .env at the repository root; production sets real env vars.
config({ path: path.join(REPO_ROOT, '.env'), quiet: true });

const DEV_AUTH_SECRET = 'little-ants-development-secret-not-for-production';

const booleanFlag = z
  .enum(['true', 'false', '1', '0'])
  .default('false')
  .transform((value) => value === 'true' || value === '1');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().positive().default(3001),
    /** Public URL of this API, used for OAuth callbacks. */
    API_PUBLIC_URL: z.string().url().default('http://localhost:3001'),
    DATABASE_URL: z.string().min(1),
    CORS_ORIGINS: z
      .string()
      .default('http://localhost:3000,http://localhost:3002')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),
    BETTER_AUTH_SECRET: z.string().min(32).optional(),
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    /** Parent domain shared by admin./teacher./api. hosts, e.g. ".littleants.vn". */
    AUTH_COOKIE_DOMAIN: z.string().min(1).optional(),
    /** Development only: allow email + password sign-in for invited staff. */
    AUTH_DEV_PASSWORD_LOGIN: booleanFlag,
    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    if (!env.BETTER_AUTH_SECRET) {
      ctx.addIssue({ code: 'custom', path: ['BETTER_AUTH_SECRET'], message: 'Required in production' });
    }
    if (env.AUTH_DEV_PASSWORD_LOGIN) {
      ctx.addIssue({ code: 'custom', path: ['AUTH_DEV_PASSWORD_LOGIN'], message: 'Must be false in production' });
    }
    if (!env.API_PUBLIC_URL.startsWith('https://')) {
      ctx.addIssue({ code: 'custom', path: ['API_PUBLIC_URL'], message: 'Must be an https URL in production' });
    }
    if (env.CORS_ORIGINS.some((origin) => !origin.startsWith('https://'))) {
      ctx.addIssue({ code: 'custom', path: ['CORS_ORIGINS'], message: 'Must list the https app origins in production' });
    }
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      ctx.addIssue({ code: 'custom', path: ['GOOGLE_CLIENT_ID'], message: 'Google sign-in is required in production' });
    }
    // Local storage serves uploaded files from the API's own origin; production uses R2.
    if (env.STORAGE_DRIVER !== 's3') {
      ctx.addIssue({ code: 'custom', path: ['STORAGE_DRIVER'], message: 'Must be s3 in production' });
    }
  })
  .transform((env) => ({
    ...env,
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET ?? DEV_AUTH_SECRET,
    googleEnabled: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
  }));

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function loadEnv(): Env {
  cached ??= parseEnv(envSchema, process.env);
  return cached;
}
