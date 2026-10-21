import { defineConfig } from 'vitest/config';

export default defineConfig({
  // A cache folder per package, so parallel test runs do not clash.
  cacheDir: '.vitest-cache',
  test: { include: ['test/**/*.test.ts'] },
});
