import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { config } from 'dotenv';
import { splitSchemaParam } from './index.js';

const repoRoot = path.resolve(import.meta.dirname, '../../..');

/**
 * Write a pg_dump custom-format backup to infra/backup/ and return its path.
 * Run before every migration or bulk data change.
 */
export function backupDatabase(label = 'manual', connectionString = process.env.DATABASE_URL): string {
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }
  const dir = path.join(repoRoot, 'infra', 'backup');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
  const file = path.join(dir, `${stamp}-${label.replaceAll(/[^a-z0-9-]/gi, '-')}.dump`);
  execFileSync('pg_dump', ['--format=custom', '--no-owner', '--exclude-schema=test*', '--file', file], {
    env: { ...process.env, ...libpqEnv(connectionString) },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  return file;
}

/** Connection settings as libpq env vars, so the password never appears in argv or process listings. */
export function libpqEnv(connectionString: string): Record<string, string> {
  const url = new URL(splitSchemaParam(connectionString).connectionString);
  const env: Record<string, string> = {
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    PGDATABASE: decodeURIComponent(url.pathname.replace(/^\//, '')),
  };
  if (url.password) env.PGPASSWORD = decodeURIComponent(url.password);
  const sslmode = url.searchParams.get('sslmode');
  if (sslmode) env.PGSSLMODE = sslmode;
  return env;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  config({ path: path.join(repoRoot, '.env'), quiet: true });
  const file = backupDatabase(process.argv[2] ?? 'manual');
  console.log(`Backup written to ${path.relative(repoRoot, file)}`);
}
