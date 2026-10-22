import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { StaffUser } from '../src/auth/staff-access.js';
import { TEST_USER_HEADER, createStaff, createTestApp, type TestApp } from './test-app.js';

describe('campuses, classes and students', () => {
  let ctx: TestApp;
  let admin: StaffUser;
  let teacher: StaffUser;
  let otherTeacher: StaffUser;
  let classId: string;
  const as = (user: StaffUser) => ({ [TEST_USER_HEADER]: user.id });
  const server = () => ctx.app.getHttpServer();

  beforeAll(async () => {
    ctx = await createTestApp({ headerAuth: true });
    admin = await createStaff(ctx.prisma, ['ADMIN'], 'Admin');
    teacher = await createStaff(ctx.prisma, ['TEACHER'], 'Teacher A');
    otherTeacher = await createStaff(ctx.prisma, ['TEACHER'], 'Teacher B');
  });

  afterAll(async () => {
    await ctx?.app.close();
  });

  it('lets an admin set up a campus, a class, teachers and students', async () => {
    const campus = await request(server())
      .post('/api/campuses')
      .set(as(admin))
      .send({ name: 'Ant Hill Campus' })
      .expect(201);
    const levels = await request(server()).get('/api/levels').set(as(admin)).expect(200);
    const level1 = levels.body.find((level: { number: number }) => level.number === 1);

    const created = await request(server())
      .post('/api/classes')
      .set(as(admin))
      .send({ campusId: campus.body.id, name: 'Ladybugs', levelId: level1.id, schoolYear: '2026-2027' })
      .expect(201);
    classId = created.body.id;

    await request(server())
      .put(`/api/classes/${classId}/teachers`)
      .set(as(admin))
      .send({ userIds: [teacher.id] })
      .expect(200);
    await request(server())
      .post(`/api/classes/${classId}/students`)
      .set(as(admin))
      .send({ displayName: 'Bé An', birthYear: 2022 })
      .expect(201);
  });

  it('changes only the fields a PATCH sends', async () => {
    const unitless = await ctx.prisma.class.findUniqueOrThrow({ where: { id: classId } });
    await ctx.prisma.class.update({ where: { id: classId }, data: { lessonDays: [2, 4] } });
    await request(server())
      .patch(`/api/classes/${classId}`)
      .set(as(admin))
      .send({ nextLesson: 12 })
      .expect(200);
    const after = await ctx.prisma.class.findUniqueOrThrow({ where: { id: classId } });
    expect(after).toMatchObject({
      nextLesson: 12,
      lessonDays: [2, 4],
      currentUnitId: unitless.currentUnitId,
      active: true,
    });
  });

  it('answers 404 for a missing record instead of a server error', async () => {
    await request(server())
      .patch('/api/students/does-not-exist')
      .set(as(admin))
      .send({ displayName: 'X' })
      .expect(404);
  });

  it('rejects invalid input with field messages', async () => {
    const response = await request(server())
      .post('/api/classes')
      .set(as(admin))
      .send({ name: '' })
      .expect(400);
    expect(response.body.issues.map((issue: { path: string }) => issue.path)).toEqual(
      expect.arrayContaining(['campusId', 'name', 'levelId', 'schoolYear']),
    );
  });

  it('shows a teacher only their own classes', async () => {
    const mine = await request(server()).get(`/api/classes/${classId}`).set(as(teacher)).expect(200);
    expect(mine.body.students).toHaveLength(1);
    await request(server()).get(`/api/classes/${classId}`).set(as(otherTeacher)).expect(403);

    const list = await request(server()).get('/api/classes').set(as(otherTeacher)).expect(200);
    expect(list.body).toEqual([]);
  });

  it('keeps class and staff management for admins', async () => {
    await request(server()).post('/api/campuses').set(as(teacher)).send({ name: 'Nope' }).expect(403);
    await request(server())
      .post(`/api/classes/${classId}/students`)
      .set(as(teacher))
      .send({ displayName: 'X' })
      .expect(403);
    await request(server()).get('/api/staff').set(as(teacher)).expect(403);
  });

  it('invites staff, changes roles and stops admins locking themselves out', async () => {
    await request(server())
      .post('/api/staff/invites')
      .set(as(admin))
      .send({ email: 'NEW@example.com', roles: ['AUTHOR'] })
      .expect(201);
    const staff = await request(server()).get('/api/staff').set(as(admin)).expect(200);
    expect(staff.body.invites.map((invite: { email: string }) => invite.email)).toContain('new@example.com');

    await request(server())
      .patch(`/api/staff/${otherTeacher.id}`)
      .set(as(admin))
      .send({ roles: ['TEACHER', 'REVIEWER'] })
      .expect(200);
    await request(server())
      .patch(`/api/staff/${admin.id}`)
      .set(as(admin))
      .send({ active: false })
      .expect(400);
    expect(
      await ctx.prisma.auditLog.count({ where: { action: 'role-change', target: otherTeacher.id } }),
    ).toBe(1);
  });
});
