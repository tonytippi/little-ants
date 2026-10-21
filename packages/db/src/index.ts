import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

export * from './generated/prisma/client.js';
export * from './content-versioning.js';
export * from './base-data.js';

/**
 * Split an optional `schema` query parameter off a Postgres URL.
 * `pg` does not understand it, so it is passed to the Prisma adapter instead.
 */
export function splitSchemaParam(connectionString: string): { connectionString: string; schema?: string } {
  const url = new URL(connectionString);
  const schema = url.searchParams.get('schema') ?? undefined;
  url.searchParams.delete('schema');
  return { connectionString: url.toString(), schema };
}

/** Create a Prisma client for the given connection string (defaults to DATABASE_URL). */
export function createPrismaClient(connectionString = process.env.DATABASE_URL): PrismaClient {
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }
  const parts = splitSchemaParam(connectionString);
  const adapter = new PrismaPg({ connectionString: parts.connectionString }, parts.schema ? { schema: parts.schema } : undefined);
  return new PrismaClient({ adapter });
}
