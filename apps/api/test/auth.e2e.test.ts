import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createStaff, createTestApp, type TestApp } from './test-app.js';

const ORIGIN = 'http://localhost:3000';

/** Real Better Auth flow with development password sign-in (Google works the same way through the same hooks). */
describe('staff sign-in', () => {
  let ctx: TestApp;
  const server = () => ctx.app.getHttpServer();

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx?.app.close();
  });

  it('tells the apps which sign-in methods exist', async () => {
    const response = await request(server()).get('/api/auth-config').expect(200);
    expect(response.body).toMatchObject({ devPassword: true });
  });

  it('refuses requests without a session', async () => {
    await request(server()).get('/api/me').expect(401);
  });

  it('refuses an email that was not invited', async () => {
    const response = await request(server())
      .post('/api/auth/sign-up/email')
      .set('Origin', ORIGIN)
      .send({ email: 'stranger@example.com', password: 'a-long-password', name: 'Stranger' });
    expect(response.status).toBe(403);
    expect(await ctx.prisma.user.findUnique({ where: { email: 'stranger@example.com' } })).toBeNull();
  });

  it('lets an invited teacher sign up, sign in and read /me with the school role from the invite', async () => {
    const admin = await createStaff(ctx.prisma, ['ADMIN']);
    const school = await ctx.prisma.school.create({ data: { name: `Auth test school ${Date.now()}` } });
    await ctx.prisma.staffInvite.create({
      data: {
        email: 'teacher@example.com',
        schoolId: school.id,
        schoolRole: 'TEACHER',
        invitedById: admin.id,
      },
    });

    await request(server())
      .post('/api/auth/sign-up/email')
      .set('Origin', ORIGIN)
      .send({ email: 'Teacher@Example.com', password: 'a-long-password', name: 'Ms Lan' })
      .expect(200);

    const signIn = await request(server())
      .post('/api/auth/sign-in/email')
      .set('Origin', ORIGIN)
      .send({ email: 'teacher@example.com', password: 'a-long-password' })
      .expect(200);
    const cookies = signIn.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((cookie) => cookie.includes('session_token'))).toBe(true);

    const me = await request(server()).get('/api/me').set('Cookie', cookies).expect(200);
    expect(me.body.user).toMatchObject({
      email: 'teacher@example.com',
      name: 'Ms Lan',
      roles: [],
      schools: [{ schoolId: school.id, role: 'TEACHER' }],
    });
    expect(me.body.schools).toEqual([{ id: school.id, name: school.name, role: 'TEACHER' }]);

    const invite = await ctx.prisma.staffInvite.findUniqueOrThrow({
      where: { email: 'teacher@example.com' },
    });
    expect(invite.acceptedAt).not.toBeNull();
    expect(
      await ctx.prisma.auditLog.count({ where: { action: 'sign-in', actorId: me.body.user.id } }),
    ).toBeGreaterThan(0);

    // Deactivating the account ends the session at once.
    await ctx.prisma.user.update({ where: { id: me.body.user.id }, data: { active: false } });
    await request(server()).get('/api/me').set('Cookie', cookies).expect(401);
    await request(server())
      .post('/api/auth/sign-in/email')
      .set('Origin', ORIGIN)
      .send({ email: 'teacher@example.com', password: 'a-long-password' })
      .expect(403);
  });
});
