import { parseArgs } from 'node:util';
import { createPrismaClient, type Role, type SchoolRole } from '@little-ants/db';
import { roleSchema, schoolRoleSchema } from '@little-ants/shared';
import { createAuth } from '../auth/auth.js';
import { loadEnv } from '../config/env.js';

const USAGE = `Usage: pnpm --filter @little-ants/api run invite-staff --email someone@example.com
         [--roles ADMIN,AUTHOR,REVIEWER] [--school "School name" --school-role TEACHER|SCHOOL_ADMIN]
         [--name "Name"] [--password "..."]

Invites a staff member (use it to create the first admin): HQ roles, a role at a school, or both.
They then sign in with Google.
--password creates a development password account at once (only when AUTH_DEV_PASSWORD_LOGIN=true).`;

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      email: { type: 'string' },
      roles: { type: 'string', default: '' },
      school: { type: 'string' },
      'school-role': { type: 'string', default: 'TEACHER' },
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
  const roles = values.roles
    .split(',')
    .filter((role) => role.trim())
    .map((role) => roleSchema.parse(role.trim().toUpperCase())) as Role[];
  const schoolRole = schoolRoleSchema.parse(values['school-role'].trim().toUpperCase()) as SchoolRole;
  if (roles.length === 0 && !values.school) throw new Error('Give --roles and/or --school\n\n' + USAGE);
  const prisma = createPrismaClient(env.DATABASE_URL);
  try {
    const school = values.school
      ? await prisma.school.findUnique({ where: { name: values.school.trim() } })
      : null;
    if (values.school && !school) throw new Error(`No school named "${values.school}"`);
    const what = [roles.join(', '), school ? `${schoolRole} at ${school.name}` : '']
      .filter(Boolean)
      .join('; ');
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { ...(roles.length ? { roles } : {}), active: true },
      });
      if (school)
        await prisma.schoolStaff.upsert({
          where: { userId_schoolId: { userId: existing.id, schoolId: school.id } },
          update: { role: schoolRole },
          create: { userId: existing.id, schoolId: school.id, role: schoolRole },
        });
      console.log(`${email} already has an account; now ${what}.`);
      return;
    }
    const schoolFields = school ? { schoolId: school.id, schoolRole } : {};
    await prisma.staffInvite.upsert({
      where: { email },
      update: { roles, ...schoolFields },
      create: { email, roles, ...schoolFields },
    });
    console.log(`Invited ${email} as ${what}.`);
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
