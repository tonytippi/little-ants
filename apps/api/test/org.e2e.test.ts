import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { StaffUser } from '../src/auth/staff-access.js';
import { OrgService } from '../src/org/org.service.js';
import { TEST_USER_HEADER, createStaff, createTestApp, type TestApp } from './test-app.js';

describe('schools, campuses, classes and children', () => {
  let ctx: TestApp;
  let admin: StaffUser;
  let schoolAdmin: StaffUser;
  let teacher: StaffUser;
  let otherTeacher: StaffUser;
  let otherSchoolAdmin: StaffUser;
  let schoolId: string;
  let otherSchoolId: string;
  let campusId: string;
  let classId: string;
  let studentId: string;
  let units: { id: string; code: string }[];
  const as = (user: StaffUser) => ({ [TEST_USER_HEADER]: user.id });
  const server = () => ctx.app.getHttpServer();
  const access = (id: string) => ctx.app.get(OrgService).studentAccess(id);

  beforeAll(async () => {
    ctx = await createTestApp({ headerAuth: true });
    admin = await createStaff(ctx.prisma, ['ADMIN'], 'HQ admin');
    const level = await ctx.prisma.level.findFirstOrThrow({ where: { number: 2 } });
    units = await Promise.all(
      [81, 82, 83].map((number) =>
        ctx.prisma.unit.create({
          data: { levelId: level.id, code: `U${number}`, number, title: `Unit ${number}` },
          select: { id: true, code: true },
        }),
      ),
    );
  });

  afterAll(async () => {
    await ctx?.app.close();
  });

  it('lets HQ create schools and only HQ', async () => {
    const created = await request(server())
      .post('/api/schools')
      .set(as(admin))
      .send({ name: `Hoa Mai ${Date.now()}` })
      .expect(201);
    schoolId = created.body.id;
    const other = await request(server())
      .post('/api/schools')
      .set(as(admin))
      .send({ name: `Sen Hồng ${Date.now()}` })
      .expect(201);
    otherSchoolId = other.body.id;

    schoolAdmin = await createStaff(ctx.prisma, [], 'School admin', [{ schoolId, role: 'SCHOOL_ADMIN' }]);
    otherSchoolAdmin = await createStaff(ctx.prisma, [], 'Other admin', [
      { schoolId: otherSchoolId, role: 'SCHOOL_ADMIN' },
    ]);
    await request(server()).post('/api/schools').set(as(schoolAdmin)).send({ name: 'Nope' }).expect(403);

    const mine = await request(server()).get('/api/schools').set(as(schoolAdmin)).expect(200);
    expect(mine.body).toEqual([expect.objectContaining({ id: schoolId, myRole: 'SCHOOL_ADMIN' })]);
  });

  it('lets a school admin add teachers by email: members at once, invites for new emails', async () => {
    teacher = await createStaff(ctx.prisma, [], 'Teacher A');
    otherTeacher = await createStaff(ctx.prisma, [], 'Teacher B');
    for (const person of [teacher, otherTeacher]) {
      const added = await request(server())
        .post(`/api/schools/${schoolId}/staff`)
        .set(as(schoolAdmin))
        .send({ email: person.email, role: 'TEACHER' })
        .expect(201);
      expect(added.body.member).toMatchObject({ userId: person.id, role: 'TEACHER' });
    }
    const invited = await request(server())
      .post(`/api/schools/${schoolId}/staff`)
      .set(as(schoolAdmin))
      .send({ email: 'New.Teacher@Example.com', role: 'TEACHER' })
      .expect(201);
    expect(invited.body.invite).toMatchObject({
      email: 'new.teacher@example.com',
      schoolId,
      schoolRole: 'TEACHER',
    });

    const staff = await request(server())
      .get(`/api/schools/${schoolId}/staff`)
      .set(as(schoolAdmin))
      .expect(200);
    expect(staff.body.members).toHaveLength(3);
    expect(staff.body.invites).toHaveLength(1);

    // Teachers cannot manage the school; other schools do not even see it.
    await request(server()).get(`/api/schools/${schoolId}/staff`).set(as(teacher)).expect(403);
    await request(server()).get(`/api/schools/${schoolId}/staff`).set(as(otherSchoolAdmin)).expect(404);
  });

  it('sets up a campus and a class on its first unit, with teachers and children', async () => {
    const campus = await request(server())
      .post(`/api/schools/${schoolId}/campuses`)
      .set(as(schoolAdmin))
      .send({ name: 'Ant Hill Campus' })
      .expect(201);
    campusId = campus.body.id;
    const level = await ctx.prisma.level.findFirstOrThrow({ where: { number: 2 } });

    const created = await request(server())
      .post(`/api/schools/${schoolId}/classes`)
      .set(as(schoolAdmin))
      .send({ campusId, name: 'Ladybugs', levelId: level.id, schoolYear: '2026-2027', unitId: units[0]!.id })
      .expect(201);
    classId = created.body.id;
    expect(created.body).toMatchObject({ currentUnitId: units[0]!.id, nextLesson: 1, status: 'ACTIVE' });

    await request(server())
      .put(`/api/classes/${classId}/teachers`)
      .set(as(schoolAdmin))
      .send({ userIds: [teacher.id] })
      .expect(200);
    // Someone who does not work at the school cannot be assigned.
    await request(server())
      .put(`/api/classes/${classId}/teachers`)
      .set(as(schoolAdmin))
      .send({ userIds: [otherSchoolAdmin.id] })
      .expect(400);

    const child = await request(server())
      .post(`/api/classes/${classId}/students`)
      .set(as(schoolAdmin))
      .send({ displayName: 'Bé An', birthYear: 2022 })
      .expect(201);
    studentId = child.body.id;

    // A campus of another school cannot hold this school's class.
    const foreign = await ctx.prisma.campus.create({ data: { schoolId: otherSchoolId, name: 'Foreign' } });
    await request(server())
      .post(`/api/schools/${schoolId}/classes`)
      .set(as(schoolAdmin))
      .send({ campusId: foreign.id, name: 'X', levelId: level.id, schoolYear: '2026-2027' })
      .expect(400);
  });

  it('shows teachers only their classes and keeps changes for school admins', async () => {
    const mine = await request(server()).get(`/api/classes/${classId}`).set(as(teacher)).expect(200);
    expect(mine.body.enrollments).toHaveLength(1);
    expect(mine.body.unitRuns).toHaveLength(1);
    await request(server()).get(`/api/classes/${classId}`).set(as(otherTeacher)).expect(403);
    const list = await request(server())
      .get(`/api/schools/${schoolId}/classes`)
      .set(as(otherTeacher))
      .expect(200);
    expect(list.body).toEqual([]);
    const all = await request(server())
      .get(`/api/schools/${schoolId}/classes`)
      .set(as(schoolAdmin))
      .expect(200);
    expect(all.body).toHaveLength(1);

    await request(server())
      .post(`/api/schools/${schoolId}/campuses`)
      .set(as(teacher))
      .send({ name: 'X' })
      .expect(403);
    await request(server())
      .post(`/api/classes/${classId}/students`)
      .set(as(teacher))
      .send({ displayName: 'X' })
      .expect(403);
    await request(server()).get(`/api/classes/${classId}`).set(as(otherSchoolAdmin)).expect(404);
    await request(server())
      .post(`/api/classes/${classId}/students`)
      .set(as(otherSchoolAdmin))
      .send({ displayName: 'X' })
      .expect(404);
  });

  it('changes only the fields a PATCH sends', async () => {
    await ctx.prisma.class.update({ where: { id: classId }, data: { lessonDays: [2, 4] } });
    await request(server())
      .patch(`/api/classes/${classId}`)
      .set(as(schoolAdmin))
      .send({ nextLesson: 12 })
      .expect(200);
    const after = await ctx.prisma.class.findUniqueOrThrow({ where: { id: classId } });
    expect(after).toMatchObject({ nextLesson: 12, lessonDays: [2, 4], currentUnitId: units[0]!.id });
  });

  it('moves the class on to the next unit and keeps the unit history', async () => {
    await request(server())
      .post(`/api/classes/${classId}/next-unit`)
      .set(as(schoolAdmin))
      .send({ unitId: units[1]!.id })
      .expect(200);
    const after = await ctx.prisma.class.findUniqueOrThrow({
      where: { id: classId },
      include: { unitRuns: { orderBy: { startedOn: 'asc' } } },
    });
    expect(after).toMatchObject({ currentUnitId: units[1]!.id, nextLesson: 1 });
    expect(after.unitRuns.filter((run) => run.endedOn === null).map((run) => run.unitId)).toEqual([
      units[1]!.id,
    ]);
    expect(after.unitRuns).toHaveLength(2);
  });

  it('gives a child the units of their classes while they are enrolled, and nothing after leaving', async () => {
    // The child joined today, so the unit that ended today is not theirs; the current one is.
    expect(await access(studentId)).toEqual({ active: true, unitIds: [units[1]!.id] });

    // Earlier history: the class did the first unit from January and the second from March, with the child.
    await ctx.prisma.enrollment.updateMany({
      where: { studentId },
      data: { startedOn: new Date('2026-01-05') },
    });
    await ctx.prisma.classUnitRun.updateMany({
      where: { classId, unitId: units[0]!.id },
      data: { startedOn: new Date('2026-01-05'), endedOn: new Date('2026-03-02') },
    });
    await ctx.prisma.classUnitRun.updateMany({
      where: { classId, unitId: units[1]!.id },
      data: { startedOn: new Date('2026-03-02') },
    });
    expect((await access(studentId)).unitIds.sort()).toEqual([units[0]!.id, units[1]!.id].sort());

    await request(server()).post(`/api/students/${studentId}/leave`).set(as(schoolAdmin)).expect(200);
    expect(await access(studentId)).toEqual({ active: false, unitIds: [] });
    await request(server()).post(`/api/students/${studentId}/leave`).set(as(schoolAdmin)).expect(400);

    // Coming back works once; a child already in a class has to be moved instead.
    await request(server())
      .post(`/api/students/${studentId}/rejoin`)
      .set(as(schoolAdmin))
      .send({ classId })
      .expect(200);
    expect((await access(studentId)).active).toBe(true);
    await request(server())
      .post(`/api/students/${studentId}/rejoin`)
      .set(as(schoolAdmin))
      .send({ classId })
      .expect(409);
    await request(server()).post(`/api/students/${studentId}/leave`).set(as(schoolAdmin)).expect(200);
  });

  it('lets a child continue at another school, keeping the units studied before', async () => {
    const level = await ctx.prisma.level.findFirstOrThrow({ where: { number: 2 } });
    const otherCampus = await ctx.prisma.campus.create({
      data: { schoolId: otherSchoolId, name: 'Sen campus' },
    });
    const otherClass = await ctx.prisma.class.create({
      data: { campusId: otherCampus.id, name: 'Frogs', levelId: level.id, schoolYear: '2026-2027' },
    });
    await ctx.app.get(OrgService).startUnit(otherClass.id, units[2]!.id);
    // HQ moves the child (a move across schools needs rights at both).
    await request(server())
      .post(`/api/students/${studentId}/move`)
      .set(as(schoolAdmin))
      .send({ classId: otherClass.id })
      .expect(404);
    await ctx.prisma.enrollment.create({
      data: { studentId, classId: otherClass.id, startedOn: new Date() },
    });
    const result = await access(studentId);
    expect(result.active).toBe(true);
    expect(result.unitIds.sort()).toEqual(units.map((unit) => unit.id).sort());
    // The new school is now responsible for the child; the old one can no longer change the record.
    await request(server())
      .patch(`/api/students/${studentId}`)
      .set(as(schoolAdmin))
      .send({ displayName: 'X' })
      .expect(404);
    await request(server())
      .patch(`/api/students/${studentId}`)
      .set(as(otherSchoolAdmin))
      .send({ displayName: 'Bé An Nguyễn' })
      .expect(200);
  });

  it('allows only one open enrollment per child and one open unit run per class', async () => {
    await expect(
      ctx.prisma.enrollment.create({ data: { studentId, classId, startedOn: new Date() } }),
    ).rejects.toThrow();
    await expect(
      ctx.prisma.classUnitRun.create({ data: { classId, unitId: units[2]!.id, startedOn: new Date() } }),
    ).rejects.toThrow();
  });

  it('merges a class into another and stops a class, ending their children there', async () => {
    const level = await ctx.prisma.level.findFirstOrThrow({ where: { number: 2 } });
    const make = async (name: string) =>
      (
        await request(server())
          .post(`/api/schools/${schoolId}/classes`)
          .set(as(schoolAdmin))
          .send({ campusId, name, levelId: level.id, schoolYear: '2026-2027', unitId: units[1]!.id })
          .expect(201)
      ).body.id as string;
    const small = await make('Small group');
    const target = await make('Big group');
    for (const name of ['Chi', 'Dũng']) {
      await request(server())
        .post(`/api/classes/${small}/students`)
        .set(as(schoolAdmin))
        .send({ displayName: name })
        .expect(201);
    }
    const merged = await request(server())
      .post(`/api/classes/${small}/merge`)
      .set(as(schoolAdmin))
      .send({ targetClassId: target })
      .expect(200);
    expect(merged.body).toEqual({ moved: 2 });
    expect(await ctx.prisma.class.findUniqueOrThrow({ where: { id: small } })).toMatchObject({
      status: 'MERGED',
      mergedIntoId: target,
    });
    expect(await ctx.prisma.enrollment.count({ where: { classId: target, endedOn: null } })).toBe(2);
    await request(server())
      .post(`/api/classes/${small}/students`)
      .set(as(schoolAdmin))
      .send({ displayName: 'Late' })
      .expect(409);

    const stopped = await request(server())
      .post(`/api/classes/${target}/stop`)
      .set(as(schoolAdmin))
      .expect(200);
    expect(stopped.body).toEqual({ ended: 2 });
    const children = await ctx.prisma.enrollment.findMany({ where: { classId: target } });
    for (const row of children) expect((await access(row.studentId)).active).toBe(false);
  });

  it('answers 404 for a missing record and 400 with field messages for invalid input', async () => {
    await request(server())
      .patch('/api/students/does-not-exist')
      .set(as(admin))
      .send({ displayName: 'X' })
      .expect(404);
    const response = await request(server())
      .post(`/api/schools/${schoolId}/classes`)
      .set(as(schoolAdmin))
      .send({ name: '' })
      .expect(400);
    expect(response.body.issues.map((issue: { path: string }) => issue.path)).toEqual(
      expect.arrayContaining(['campusId', 'name', 'levelId', 'schoolYear']),
    );
  });

  it('closes the student app for children of a school HQ deactivates', async () => {
    expect((await access(studentId)).active).toBe(true);
    await request(server())
      .patch(`/api/schools/${otherSchoolId}`)
      .set(as(admin))
      .send({ active: false })
      .expect(200);
    expect(await access(studentId)).toEqual({ active: false, unitIds: [] });
    await request(server())
      .patch(`/api/schools/${otherSchoolId}`)
      .set(as(admin))
      .send({ active: true })
      .expect(200);
  });

  it('invites HQ staff, changes roles and stops admins locking themselves out', async () => {
    await request(server())
      .post('/api/staff/invites')
      .set(as(admin))
      .send({ email: 'NEW@example.com', roles: ['AUTHOR'] })
      .expect(201);
    const staff = await request(server()).get('/api/staff').set(as(admin)).expect(200);
    expect(staff.body.invites.map((invite: { email: string }) => invite.email)).toContain('new@example.com');
    await request(server()).get('/api/staff').set(as(schoolAdmin)).expect(403);

    await request(server())
      .patch(`/api/staff/${otherTeacher.id}`)
      .set(as(admin))
      .send({ roles: ['REVIEWER'] })
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
