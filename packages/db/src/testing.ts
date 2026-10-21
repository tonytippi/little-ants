import { execFileSync } from 'node:child_process';
import path from 'node:path';
import pg from 'pg';
import { splitSchemaParam } from './index.js';

/**
 * Connection string for tests: TEST_DATABASE_URL, or DATABASE_URL pointed at a separate schema.
 * Each package passes its own schema (test_db, test_api, ...) so parallel test runs never collide,
 * and tests never touch the `public` schema.
 */
export function testDatabaseUrl(schema = 'test'): string {
  if (!/^test(_[a-z0-9]+)?$/.test(schema)) {
    throw new Error('Test schema names must start with "test"');
  }
  const base = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!base) {
    throw new Error('Set TEST_DATABASE_URL or DATABASE_URL to run database tests');
  }
  const url = new URL(base);
  url.searchParams.set('schema', schema);
  return url.toString();
}

/** Drop and recreate a test schema, then apply all migrations to it. */
export async function resetTestDatabase(schema = 'test'): Promise<string> {
  const testUrl = testDatabaseUrl(schema);
  const { connectionString } = splitSchemaParam(testUrl);
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await client.query(`CREATE SCHEMA "${schema}"`);
  } finally {
    await client.end();
  }
  const packageRoot = path.resolve(import.meta.dirname, '..');
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: packageRoot,
    env: { ...process.env, DATABASE_URL: testUrl },
    stdio: 'pipe',
  });
  return testUrl;
}
