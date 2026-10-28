import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { StaffUser } from '../src/auth/staff-access.js';
import { OrgService } from '../src/org/org.service.js';
import { checkClaims, GoogleIdentityVerifier } from '../src/parents/google-identity.js';
import { TEST_USER_HEADER, createSchool, createStaff, createTestApp, type TestApp } from './test-app.js';

const CLIENT_ID = 'test-client';
const fakeGoogle = {
  identify: async (code: string, _redirectUri: string, nonce: string) =>
    checkClaims(JSON.parse(code) as Parameters<typeof checkClaims>[0], CLIENT_ID, nonce),
};

const leaves = Array.from({ length: 40 }, (_, index) => ({
  number: index + 1,
  stage: 'LISTEN_AND_JOIN_IN',
  minutes: 3,
  items: [{ kind: 'material', code: 'SG1', type: 'SONG', title: 'Hello song', seconds: 60 }],
}));

describe('Listening Time: what children play and their progress', () => {
  let ctx: TestApp;
  let teacher: StaffUser;
  let classId: string;
  let studentId: string;
  let otherStudentId: string;
  let parentCookie: string;
  const server = () => ctx.app.getHttpServer();
  const asStaff = (user: StaffUser) => ({ [TEST_USER_HEADER]: user.id });
  let counter = 0;
  const log = (leaf: number, playedOn: string, items: string[] = ['SG1']) => ({
    clientId: crypto.randomUUID(),
    unitCode: 'U51',
    leaf,
    playedOn,
    completedAt: new Date(Date.parse(`${playedOn}T10:00:00Z`) + (counter += 1) * 1000).toISOString(),
    itemsHeard: items,
  });
  const sync = (logs: ReturnType<typeof log>[], child = studentId) =>
    request(server())
      .post(`/api/parent/students/${child}/listening/sync`)
      .set('Cookie', parentCookie)
      .send({ logs })
      .expect(201);

  beforeAll(async () => {
    ctx = await createTestApp({ headerAuth: true, providers: [[GoogleIdentityVerifier, fakeGoogle]] });
    const school = await createSchool(ctx.prisma, 'Listening school');
    teacher = await createStaff(ctx.prisma, [], 'Teacher', [{ schoolId: school.schoolId, role: 'TEACHER' }]);
    const level = await ctx.prisma.level.findFirstOrThrow({ where: { number: 2 } });
    const unit = await ctx.prisma.unit.create({
      data: { levelId: level.id, code: 'U51', number: 51, title: 'Listening Hill' },
    });
    await ctx.prisma.unit.create({ data: { levelId: level.id, code: 'U52', number: 52, title: 'Not yet' } });
    const media = (id: string, kind: string) => ({
      id,
      kind,
      mimeType: 'x',
      url: `https://m/${id}`,
      sizeBytes: 1,
      fileName: id,
    });
    await ctx.prisma.unitRelease.create({
      data: {
        unitId: unit.id,
        version: 1,
        payload: {
          version: 1,
          publishedAt: new Date().toISOString(),
          unit: {
            code: 'U51',
            number: 51,
            title: 'Listening Hill',
            level: { number: 2, name: 'Busy Ants' },
            leadCharacter: null,
            cover: null,
            sounds: [],
          },
          words: [],
          lessons: [{ number: 1, steps: [] }],
          materials: [
            {
              code: 'SG1',
              type: 'SONG',
              title: 'Hello song',
              fullText: 'Hello!',
              actions: '',
              teacherNotes: 'Only for teachers',
              pages: [],
              media: [
                { ...media('song', 'AUDIO'), role: 'audio' },
                { ...media('layout', 'PDF'), role: 'draft-layout' },
              ],
            },
          ],
          listening: { bridge: null, leaves },
        },
      },
    });
    const klass = await ctx.prisma.class.create({
      data: {
        campusId: school.campusId,
        name: 'Owls',
        levelId: level.id,
        schoolYear: '2026-2027',
        teachers: { create: { userId: teacher.id } },
      },
    });
    classId = klass.id;
    await ctx.app.get(OrgService).startUnit(classId, unit.id);
    const child = (displayName: string) =>
      ctx.prisma.student.create({
        data: { displayName, enrollments: { create: { classId, startedOn: new Date('2026-09-01') } } },
      });
    studentId = (await child('Bé An')).id;
    otherStudentId = (await child('Bé Bình')).id;
    await ctx.prisma.parent.create({
      data: { email: 'dad@example.com', children: { create: { studentId } } },
    });

    const start = await request(server()).get('/api/parent/auth/google/start').expect(302);
    const url = new URL(start.headers.location as string);
    const signInCookie = (start.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
    const code = JSON.stringify({
      iss: 'https://accounts.google.com',
      aud: CLIENT_ID,
      sub: 'google-dad',
      email: 'dad@example.com',
      email_verified: true,
      nonce: url.searchParams.get('nonce'),
      exp: Math.floor(Date.now() / 1000) + 600,
    });
    const callback = await request(server())
      .get('/api/parent/auth/google/callback')
      .query({ state: url.searchParams.get('state'), code })
      .set('Cookie', signInCookie)
      .expect(302);
    parentCookie = (callback.headers['set-cookie'] as unknown as string[])
      .map((cookie) => cookie.split(';')[0]!)
      .find((cookie) => cookie.startsWith('la_parent='))!;
  });

  afterAll(async () => {
    await ctx?.app.close();
  });

  it('serves the leaves and what they play, without staff material', async () => {
    const response = await request(server())
      .get(`/api/parent/students/${studentId}/units/u51/listening`)
      .set('Cookie', parentCookie)
      .expect(200);
    expect(response.body.leaves).toHaveLength(40);
    expect(response.body.materials[0].media.map((item: { id: string }) => item.id)).toEqual(['song']);
    expect(JSON.stringify(response.body)).not.toContain('Only for teachers');
    expect(response.body).not.toHaveProperty('lessons');

    await request(server())
      .get(`/api/parent/students/${studentId}/units/U52/listening`)
      .set('Cookie', parentCookie)
      .expect(404);
    await request(server())
      .get(`/api/parent/students/${otherStudentId}/units/U51/listening`)
      .set('Cookie', parentCookie)
      .expect(404);
  });

  it('opens leaves in order, at most two new a day, and always accepts repeats', async () => {
    const first = await sync([log(1, '2026-10-26'), log(2, '2026-10-26'), log(3, '2026-10-26')]);
    expect(first.body.accepted).toHaveLength(2);
    expect(first.body.rejected).toEqual([
      expect.objectContaining({ reason: 'At most two new leaves a day' }),
    ]);

    const skip = log(5, '2026-10-27');
    const repeat = log(1, '2026-10-27', ['SG1', 'WC:U51-01']);
    const third = log(3, '2026-10-27');
    const second = await sync([skip, repeat, third]);
    expect(second.body.accepted).toEqual([repeat.clientId, third.clientId]);
    expect(second.body.rejected).toEqual([
      { clientId: skip.clientId, reason: 'Leaves open one after another' },
    ]);

    // Uploading the same records again (an offline retry) stores nothing twice.
    await sync([repeat, third]);
    expect(await ctx.prisma.listeningLog.count({ where: { studentId } })).toBe(4);
  });

  it('refuses dates that are not real or do not match when the leaf was finished', async () => {
    await request(server())
      .post(`/api/parent/students/${studentId}/listening/sync`)
      .set('Cookie', parentCookie)
      .send({ logs: [{ ...log(4, '2026-10-27'), playedOn: '2026-02-30' }] })
      .expect(400);
    const shifted = { ...log(4, '2026-10-27'), playedOn: '2026-10-20' };
    const future = log(4, '2099-01-01');
    const response = await sync([shifted, future]);
    expect(response.body.accepted).toEqual([]);
    expect(response.body.rejected.map((item: { reason: string }) => item.reason)).toEqual([
      'The date on the device does not match',
      'The date on the device does not match',
    ]);
    await request(server())
      .get(`/api/parent/students/${studentId}/listening/summary`)
      .query({ unit: 'U51', today: '2026-13-45' })
      .set('Cookie', parentCookie)
      .expect(200);
  });

  it('sums up leaves, days per week and times heard', async () => {
    const summary = await request(server())
      .get(`/api/parent/students/${studentId}/listening/summary`)
      .query({ unit: 'U51', today: '2026-10-27' })
      .set('Cookie', parentCookie)
      .expect(200);
    expect(summary.body).toMatchObject({ completed: [1, 2, 3], nextLeaf: 4, newToday: 1 });
    expect(summary.body.weeks[0]).toEqual({ weekStart: '2026-10-26', days: 2 });
    expect(summary.body.weeks).toHaveLength(8);
    expect(summary.body.heard).toEqual({ SG1: 4, 'WC:U51-01': 1 });
  });

  it('shows the teacher home listening per child and records leaves played in class', async () => {
    const response = await request(server())
      .get(`/api/teach/classes/${classId}/listening`)
      .query({ today: '2026-10-28' })
      .set(asStaff(teacher))
      .expect(200);
    expect(response.body).toMatchObject({ goalDays: 4, reachedThisWeek: 0 });
    expect(response.body.children).toEqual([
      expect.objectContaining({
        id: studentId,
        hasParent: true,
        weeks: expect.arrayContaining([{ weekStart: '2026-10-26', days: 2 }]),
      }),
      expect.objectContaining({ id: otherStudentId, hasParent: false }),
    ]);

    const clientId = crypto.randomUUID();
    const synced = await request(server())
      .post('/api/teach/sync')
      .set(asStaff(teacher))
      .send({
        listeningRuns: [{ clientId, classId, unitCode: 'U51', leaf: 1, playedAt: new Date().toISOString() }],
      })
      .expect(201);
    expect(synced.body.accepted).toEqual([clientId]);
    expect(await ctx.prisma.classListeningRun.count({ where: { classId } })).toBe(1);
  });
});
