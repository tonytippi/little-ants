import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DEFAULT_ADMIN_EMAIL } from '@little-ants/db';
import { AppModule } from '../app.module.js';
import { loadEnv } from '../config/env.js';
import { ContentService } from '../content/content.service.js';
import { OrgService } from '../org/org.service.js';
import { ReleaseBuilder } from '../releases/release-builder.service.js';
import { seedTestData } from './test-data.js';

/**
 * Usage: pnpm --filter @little-ants/api run seed-test
 *
 * For testing only: approves and publishes every imported unit as it is and creates the
 * test school's "Mio Lingo" campus with a "Unit 5" class. Run it after the curriculum import (and after every reset).
 */
async function main(): Promise<void> {
  loadEnv();
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const content = app.get(ContentService);
    const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase() || DEFAULT_ADMIN_EMAIL;
    // Revisions and releases name the seed admin once they have signed in; before that, no one.
    const admin = await content.db.user.findUnique({ where: { email: adminEmail }, select: { id: true } });
    await seedTestData(
      content,
      app.get(ReleaseBuilder),
      app.get(OrgService),
      { id: admin?.id ?? null, roles: ['ADMIN'] },
      (line) => console.log(line),
      // Comma-separated Google emails that may sign in to the student app as test parents.
      (process.env.SEED_TEST_PARENT_EMAILS ?? '')
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    );
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
