import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // Standalone output keeps the monorepo layout (apps/<app>/server.js) so workspace packages are traced.
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  // Versions the service worker; set BUILD_ID (e.g. the git commit) when building images.
  env: { NEXT_PUBLIC_BUILD_ID: process.env.BUILD_ID ?? String(Date.now()) },
  transpilePackages: ['@little-ants/ui'],
  // The Cast receiver is a static page (classroom TVs run a browser too old for the app); keep its registered URL.
  rewrites: async () => [{ source: '/cast-receiver', destination: '/cast-receiver/index.html' }],
};

export default nextConfig;
