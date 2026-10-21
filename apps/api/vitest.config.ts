import path from 'node:path';
import { config } from 'dotenv';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';
import { testDatabaseUrl } from '@little-ants/db/testing';

config({ path: path.resolve(import.meta.dirname, '../../.env'), quiet: true });

// Tests run against their own schema and with development sign-in enabled.
process.env.DATABASE_URL = testDatabaseUrl('test_api');
process.env.NODE_ENV = 'test';
process.env.AUTH_DEV_PASSWORD_LOGIN = 'true';
process.env.STORAGE_DRIVER = 'local';

// SWC keeps decorator metadata, which Nest dependency injection needs.
export default defineConfig({
  // A cache folder per package, so parallel test runs do not clash.
  cacheDir: '.vitest-cache',
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
    globalSetup: ['test/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
