import { parseArgs } from 'node:util';
import { createPrismaClient, type Role } from '@little-ants/db';
import { roleSchema } from '@little-ants/shared';
import { createAuth } from '../auth/auth.js';
import { loadEnv } from '../config/env.js';

const USAGE = `Usage: pnpm --filter @little-ants/api run invite-staff --email someone@example.com --roles ADMIN[,TEACHER] [--name "Name"] [--password "..."]

Invites a staff member (use it to create the first admin). They then sign in with Google.
--password creates a development password account at once (only when AUTH_DEV_PASSWORD_LOGIN=true).`;

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      email: { type: 'string' },
      roles: { type: 'string', default: 'TEACHER' },
      name: { type: 'string' },
      password: { type: 'string' },
    },
  });
  if (!values.email) {
    console.log(USAGE);
    process.exitCode = 1;
    return;
  }
  const env = loadEnv();
  const email = values.email.trim().toLowerCase();
  const roles = values.roles.split(',').map((role) => roleSchema.parse(role.trim().toUpperCase())) as Role[];
  const prisma = createPrismaClient(env.DATABASE_URL);
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      await prisma.user.update({ where: { id: existing.id }, data: { roles, active: true } });
      console.log(`${email} already has an account; roles set to ${roles.join(', ')}.`);
      return;
    }
    await prisma.staffInvite.upsert({ where: { email }, update: { roles }, create: { email, roles } });
    console.log(`Invited ${email} as ${roles.join(', ')}.`);
    if (values.password) {
      if (!env.AUTH_DEV_PASSWORD_LOGIN)
        throw new Error('--password needs AUTH_DEV_PASSWORD_LOGIN=true (development only)');
      const auth = createAuth(prisma, env);
      await auth.api.signUpEmail({
        body: { email, password: values.password, name: values.name ?? email.split('@')[0]! },
      });
      console.log('Development password account created.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
