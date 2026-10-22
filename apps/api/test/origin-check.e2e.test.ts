import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { StaffUser } from '../src/auth/staff-access.js';
import { TEST_USER_HEADER, createStaff, createTestApp, type TestApp } from './test-app.js';

describe('cross-site request protection', () => {
  let ctx: TestApp;
  let admin: StaffUser;
  const server = () => ctx.app.getHttpServer();

  beforeAll(async () => {
    ctx = await createTestApp({ headerAuth: true });
    admin = await createStaff(ctx.prisma, ['ADMIN']);
  });

  afterAll(async () => {
    await ctx?.app.close();
  });

  it('rejects a state-changing request from another site, even with a valid session', async () => {
    const response = await request(server())
      .post('/api/campuses')
      .set({
        [TEST_USER_HEADER]: admin.id,
        Origin: 'https://media.littleants.vn',
        'Sec-Fetch-Site': 'same-site',
      })
      .send({ name: 'Forged' });
    expect(response.status).toBe(403);
    expect(await ctx.prisma.campus.count({ where: { name: 'Forged' } })).toBe(0);
  });

  it('rejects a cross-site browser request that hides its origin', async () => {
    await request(server())
      .post('/api/campuses')
      .set({ [TEST_USER_HEADER]: admin.id, 'Sec-Fetch-Site': 'cross-site' })
      .send({ name: 'Forged 2' })
      .expect(403);
  });

  it('allows the app origins and reads from anywhere', async () => {
    await request(server())
      .post('/api/campuses')
      .set({ [TEST_USER_HEADER]: admin.id, Origin: 'http://localhost:3000' })
      .send({ name: 'Real campus' })
      .expect(201);
    await request(server())
      .get('/api/campuses')
      .set({ [TEST_USER_HEADER]: admin.id, Origin: 'https://evil.example' })
      .expect(200);
  });

  it('refuses accounts that have no role', async () => {
    const nobody = await createStaff(ctx.prisma, [], 'No role');
    await request(server())
      .get('/api/me')
      .set({ [TEST_USER_HEADER]: nobody.id })
      .expect(403);
  });
});
