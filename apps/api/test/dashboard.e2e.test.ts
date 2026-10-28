import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { StaffUser } from '../src/auth/staff-access.js';
import { today } from '../src/org/org.service.js';
import { TEST_USER_HEADER, createSchool, createStaff, createTestApp, type TestApp } from './test-app.js';

describe('dashboard', () => {
  let ctx: TestApp;
  let schoolId: string;
  let schoolAdmin: StaffUser;
  let hqAdmin: StaffUser;
  let otherAdmin: StaffUser;
  const server = () => ctx.app.getHttpServer();
  const as = (user: StaffUser) => ({ [TEST_USER_HEADER]: user.id });

  beforeAll(async () => {
    ctx = await createTestApp({ headerAuth: true });
    const school = await createSchool(ctx.prisma, 'Dashboard school');
    schoolId = school.schoolId;
    schoolAdmin = await createStaff(ctx.prisma, [], 'Dashboard admin', [{ schoolId, role: 'SCHOOL_ADMIN' }]);
    hqAdmin = await createStaff(ctx.prisma, ['ADMIN'], 'HQ admin');
    const other = await createSchool(ctx.prisma, 'Other dashboard school');
    otherAdmin = await createStaff(ctx.prisma, [], 'Other admin', [
      { schoolId: other.schoolId, role: 'SCHOOL_ADMIN' },
    ]);

    const level = await ctx.prisma.level.findFirstOrThrow({ where: { number: 1 } });
    const klass = await ctx.prisma.class.create({
      data: { campusId: school.campusId, name: 'Ladybugs', levelId: level.id, schoolYear: '2026-2027' },
    });
    const add = (body: object) =>
      request(server()).post(`/api/classes/${klass.id}/students`).set(as(schoolAdmin)).send(body).expect(201);
    const an = await add({
      displayName: 'Bé An',
      consentAt: '2026-09-01',
      parents: [{ email: 'an.mom@example.com' }],
    });
    await add({ displayName: 'Bé Bình' });
    await ctx.prisma.listeningLog.createMany({
      data: [1, 2].map((leaf) => ({
        clientId: `dashboard-${leaf}`,
        studentId: an.body.id as string,
        unitCode: 'U01',
        leaf,
        playedOn: today(),
        completedAt: new Date(),
      })),
    });
  });

  afterAll(async () => {
    await ctx?.app.close();
  });

  it('gives a school admin their school, with what needs attention and 14 days of listening', async () => {
    const response = await request(server())
      .get(`/api/dashboard?schoolId=${schoolId}`)
      .set(as(schoolAdmin))
      .expect(200);
    expect(response.body.content).toBeNull();
    expect(response.body.network).toBeNull();
    const { school } = response.body;
    expect(school.totals).toEqual({
      activeClasses: 1,
      childrenInClass: 2,
      parents: 1,
      parentsSignedIn: 0,
      staff: 1,
    });
    expect(school.attention).toEqual({
      noConsent: 1,
      noParent: 1,
      classesWithoutTeacher: 1,
      classesWithoutUnit: 1,
    });
    expect(school.listening).toHaveLength(14);
    expect(school.listening.at(-1)).toEqual({
      day: today().toISOString().slice(0, 10),
      leaves: 2,
      children: 1,
    });
    expect(school.classes).toEqual([
      expect.objectContaining({ name: 'Ladybugs', children: 2, currentUnit: null, lastTaughtAt: null }),
    ]);
  });

  it('gives HQ admins content and the network, and hides other schools', async () => {
    const hq = await request(server()).get('/api/dashboard').set(as(hqAdmin)).expect(200);
    expect(hq.body.content.units).toEqual(expect.objectContaining({ DRAFT: expect.any(Number) }));
    expect(hq.body.network).toEqual(expect.objectContaining({ schools: expect.any(Number) }));
    expect(hq.body.school).toBeNull();
    await request(server()).get(`/api/dashboard?schoolId=${schoolId}`).set(as(otherAdmin)).expect(404);
  });
});
