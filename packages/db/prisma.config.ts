import path from 'node:path';
import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// The workspace keeps one .env at the repository root.
config({ path: path.resolve(import.meta.dirname, '../../.env'), quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
