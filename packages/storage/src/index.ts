import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { z } from 'zod';
import { parseEnv } from '@little-ants/shared';
import { LocalStorage } from './local-storage.js';
import { S3Storage } from './s3-storage.js';
import type { ObjectStorage } from './types.js';

export * from './types.js';
export { LocalStorage, type LocalUrlAction } from './local-storage.js';
export { S3Storage } from './s3-storage.js';

/** Files on the server's disk: all of them in development, the private ones (drafts included) in production. */
const localFields = {
  STORAGE_LOCAL_DIR: z.string().min(1).optional(),
  /** The API's storage route, e.g. https://api.example.com/api/storage */
  STORAGE_LOCAL_BASE_URL: z.string().url().default('http://localhost:3001/api/storage'),
  STORAGE_SIGNING_SECRET: z.string().min(16).optional(),
};

const storageEnvSchema = z.discriminatedUnion('STORAGE_DRIVER', [
  z.object({ STORAGE_DRIVER: z.literal('local'), ...localFields }),
  z.object({
    STORAGE_DRIVER: z.literal('s3'),
    ...localFields,
    S3_ENDPOINT: z.string().url(),
    S3_REGION: z.string().default('auto'),
    /** Public bucket behind the media domain: approved files only. */
    S3_PUBLIC_BUCKET: z.string().min(1),
    S3_ACCESS_KEY_ID: z.string().min(1),
    S3_SECRET_ACCESS_KEY: z.string().min(1),
    S3_FORCE_PATH_STYLE: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    MEDIA_PUBLIC_BASE_URL: z.string().url(),
  }),
]);

/**
 * Build the configured storage from environment variables.
 * `repoRoot` is used for the default local folder (infra/storage).
 */
export function createStorageFromEnv(
  source: Record<string, string | undefined>,
  repoRoot: string,
): ObjectStorage {
  const env = parseEnv(storageEnvSchema, { STORAGE_DRIVER: 'local', ...source });
  if (!env.STORAGE_SIGNING_SECRET && source.NODE_ENV === 'production') {
    throw new Error('STORAGE_SIGNING_SECRET is required in production');
  }
  const files = new LocalStorage({
    rootDir: env.STORAGE_LOCAL_DIR ?? path.join(repoRoot, 'infra', 'storage'),
    baseUrl: env.STORAGE_LOCAL_BASE_URL.replace(/\/$/, ''),
    // In development a per-process secret is enough: the process that signs a URL also checks it.
    signingSecret: env.STORAGE_SIGNING_SECRET ?? randomBytes(32).toString('hex'),
  });
  if (env.STORAGE_DRIVER === 'local') return files;
  return new S3Storage(
    {
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      bucket: env.S3_PUBLIC_BUCKET,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      publicBaseUrl: env.MEDIA_PUBLIC_BASE_URL,
    },
    files,
  );
}
