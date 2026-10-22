import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { StaffUser } from '../src/auth/staff-access.js';
import { TEST_USER_HEADER, createStaff, createTestApp, type TestApp } from './test-app.js';

describe('Drive sync requests', () => {
  let ctx: TestApp;
  let admin: StaffUser;
  let author: StaffUser;
  const as = (user: StaffUser) => ({ [TEST_USER_HEADER]: user.id });
  const server = () => ctx.app.getHttpServer();

  beforeAll(async () => {
    ctx = await createTestApp({ headerAuth: true });
    await ctx.prisma.importRun.deleteMany();
    admin = await createStaff(ctx.prisma, ['ADMIN'], 'Admin');
    author = await createStaff(ctx.prisma, ['AUTHOR', 'REVIEWER'], 'Author');
  });

  afterAll(async () => {
    await ctx?.app.close();
  });

  it('lets only admins request and view syncs', async () => {
    await request(server()).post('/api/imports').set(as(author)).expect(403);
    await request(server()).get('/api/imports').set(as(author)).expect(403);
  });

  it('queues one sync at a time and shows its report when the worker finishes', async () => {
    const [first, second] = await Promise.all([
      request(server()).post('/api/imports').set(as(admin)),
      request(server()).post('/api/imports').set(as(admin)),
    ]);
    expect([first.status, second.status].sort()).toEqual([201, 409]);
    const run = (first.status === 201 ? first : second).body;
    expect(run).toMatchObject({ status: 'QUEUED', requestedBy: { id: admin.id, name: 'Admin' } });

    // What the worker writes back.
    await ctx.prisma.importRun.update({ where: { id: run.id }, data: { status: 'SUCCEEDED', report: '# Master Sheet import report', finishedAt: new Date() } });
    const list = await request(server()).get('/api/imports').set(as(admin)).expect(200);
    expect(list.body[0]).toMatchObject({ id: run.id, status: 'SUCCEEDED' });
    expect(list.body[0].report).toBeUndefined();
    const detail = await request(server()).get(`/api/imports/${run.id}`).set(as(admin)).expect(200);
    expect(detail.body.report).toBe('# Master Sheet import report');

    await request(server()).post('/api/imports').set(as(admin)).expect(201);
    expect(await ctx.prisma.auditLog.count({ where: { action: 'drive-sync', actorId: admin.id } })).toBe(2);
  });

  it('answers 404 for an unknown run', async () => {
    await request(server()).get('/api/imports/missing').set(as(admin)).expect(404);
  });
});
