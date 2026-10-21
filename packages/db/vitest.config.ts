import path from 'node:path';
import { config } from 'dotenv';
import { defineConfig } from 'vitest/config';

config({ path: path.resolve(import.meta.dirname, '../../.env'), quiet: true });

export default defineConfig({
  // A cache folder per package, so parallel test runs do not clash.
  cacheDir: '.vitest-cache',
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/global-setup.ts'],
    fileParallelism: false,
  },
});
