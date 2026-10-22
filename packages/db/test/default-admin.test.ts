import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, seedDefaultAdmin, type PrismaClient } from '../src/index.js';
import { testDatabaseUrl } from '../src/testing.js';
import { TEST_SCHEMA } from './global-setup.js';

describe('seedDefaultAdmin', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = createPrismaClient(testDatabaseUrl(TEST_SCHEMA));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('invites a new email with every staff role and is safe to repeat', async () => {
    expect(await seedDefaultAdmin(prisma, ' New.Admin@Example.com ')).toBe('invited');
    expect(await seedDefaultAdmin(prisma, 'new.admin@example.com')).toBe('invited');
    const invite = await prisma.staffInvite.findUniqueOrThrow({ where: { email: 'new.admin@example.com' } });
    expect([...invite.roles].sort()).toEqual(['ADMIN', 'AUTHOR', 'REVIEWER', 'TEACHER']);
  });

  it('adds the roles to an existing account without removing others and reactivates it', async () => {
    await prisma.user.create({
      data: {
        id: 'existing-admin',
        email: 'existing@example.com',
        name: 'Existing',
        roles: ['TEACHER'],
        active: false,
      },
    });
    expect(await seedDefaultAdmin(prisma, 'existing@example.com')).toBe('updated');
    const user = await prisma.user.findUniqueOrThrow({ where: { id: 'existing-admin' } });
    expect(user.active).toBe(true);
    expect([...user.roles].sort()).toEqual(['ADMIN', 'AUTHOR', 'REVIEWER', 'TEACHER']);
    expect(await prisma.staffInvite.findUnique({ where: { email: 'existing@example.com' } })).toBeNull();
  });
});
