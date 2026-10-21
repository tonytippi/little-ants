import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // Standalone output keeps the monorepo layout (apps/<app>/server.js) so workspace packages are traced.
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  transpilePackages: ['@little-ants/ui'],
};

export default nextConfig;
