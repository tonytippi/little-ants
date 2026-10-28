import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { StaffUser } from '../src/auth/staff-access.js';
import { OrgService } from '../src/org/org.service.js';
import { checkClaims, GoogleIdentityVerifier } from '../src/parents/google-identity.js';
import { ParentAuthService } from '../src/parents/parent-auth.service.js';
import { TEST_USER_HEADER, createSchool, createStaff, createTestApp, type TestApp } from './test-app.js';

const CLIENT_ID = 'test-client';

/** Stands in for Google: the "code" is the ID token's claims as JSON; the claim checks are the real ones. */
const fakeGoogle = {
  identify: async (code: string, _redirectUri: string, nonce: string) =>
    checkClaims(JSON.parse(code) as Parameters<typeof checkClaims>[0], CLIENT_ID, nonce),
};

interface Started {
  state: string;
  nonce: string;
  cookie: string;
}

describe('parent sign-in and the two-device limit', () => {
  let ctx: TestApp;
  let schoolAdmin: StaffUser;
  let schoolId: string;
  let studentId: string;
  let otherStudentId: string;
  const PARENT = 'mother@example.com';
  const server = () => ctx.app.getHttpServer();
  const asStaff = (user: StaffUser) => ({ [TEST_USER_HEADER]: user.id });

  const cookieValue = (headers: Record<string, unknown>, name: string): string | undefined =>
    ((headers['set-cookie'] as string[] | undefined) ?? [])
      .map((cookie) => cookie.split(';')[0]!)
      .find((cookie) => cookie.startsWith(`${name}=`) && cookie.length > name.length + 1);

  async function start(): Promise<Started> {
    const response = await request(server()).get('/api/parent/auth/google/start?return=/path').expect(302);
    const url = new URL(response.headers.location as string);
    return {
      state: url.searchParams.get('state')!,
      nonce: url.searchParams.get('nonce')!,
      cookie: cookieValue(response.headers, 'la_parent_signin')!,
    };
  }

  const claims = (nonce: string, email = PARENT, sub = 'google-mother') =>
    JSON.stringify({
      iss: 'https://accounts.google.com',
      aud: CLIENT_ID,
      sub,
      email,
      email_verified: true,
      name: 'Mẹ An',
      nonce,
      exp: Math.floor(Date.now() / 1000) + 600,
    });

  async function callback(started: Started, code: string, userAgent = 'Mozilla/5.0 (iPhone) Safari/604.1') {
    return request(server())
      .get('/api/parent/auth/google/callback')
      .query({ state: started.state, code })
      .set('Cookie', started.cookie)
      .set('User-Agent', userAgent)
      .expect(302);
  }

  /** A full sign-in; returns the session cookie, or the redirect when there is none. */
  async function signIn(userAgent?: string): Promise<{ cookie?: string; location: string }> {
    const started = await start();
    const response = await callback(started, claims(started.nonce), userAgent);
    return {
      cookie: cookieValue(response.headers, 'la_parent'),
      location: response.headers.location as string,
    };
  }

  beforeAll(async () => {
    ctx = await createTestApp({ headerAuth: true, providers: [[GoogleIdentityVerifier, fakeGoogle]] });
    const school = await createSchool(ctx.prisma, 'Parents school');
    schoolId = school.schoolId;
    schoolAdmin = await createStaff(ctx.prisma, [], 'School admin', [
      { schoolId: school.schoolId, role: 'SCHOOL_ADMIN' },
    ]);
    const level = await ctx.prisma.level.findFirstOrThrow({ where: { number: 2 } });
    const unit = await ctx.prisma.unit.create({
      data: { levelId: level.id, code: 'U61', number: 61, title: 'Listening unit' },
    });
    await ctx.prisma.unitRelease.create({
      data: { unitId: unit.id, version: 1, payload: { unit: { cover: null, leadCharacter: null } } },
    });
    const klass = await ctx.prisma.class.create({
      data: { campusId: school.campusId, name: 'Bees', levelId: level.id, schoolYear: '2026-2027' },
    });
    await ctx.app.get(OrgService).startUnit(klass.id, unit.id);
    const add = (displayName: string) =>
      request(server())
        .post(`/api/classes/${klass.id}/students`)
        .set(asStaff(schoolAdmin))
        .send({ displayName })
        .expect(201);
    studentId = (await add('Bé An')).body.id;
    otherStudentId = (await add('Bé Bình')).body.id;
  });

  afterAll(async () => {
    await ctx?.app.close();
  });

  it('refuses a Google account the school has not registered', async () => {
    const result = await signIn();
    expect(result.cookie).toBeUndefined();
    expect(result.location).toContain('/signin?error=not-registered');
  });

  it('lets staff register a parent by email, then the parent signs in and sees the child and units', async () => {
    await request(server())
      .post(`/api/students/${studentId}/parents`)
      .set(asStaff(schoolAdmin))
      .send({ email: 'Mother@Example.com', relationship: 'Mother' })
      .expect(201);
    const result = await signIn();
    expect(result.location).toBe('http://localhost:3003/path');
    const me = await request(server()).get('/api/parent/me').set('Cookie', result.cookie!).expect(200);
    expect(me.body.parent).toEqual({ name: 'Mẹ An', email: PARENT });
    expect(me.body.children).toEqual([
      expect.objectContaining({
        id: studentId,
        displayName: 'Bé An',
        units: [expect.objectContaining({ code: 'U61', current: true })],
      }),
    ]);
    const parents = await request(server())
      .get(`/api/students/${studentId}/parents`)
      .set(asStaff(schoolAdmin))
      .expect(200);
    expect(parents.body[0].parent.email).toBe(PARENT);
  });

  it('lists the parent accounts of a school and signs one out on every device', async () => {
    const list = await request(server())
      .get(`/api/schools/${schoolId}/parents`)
      .set(asStaff(schoolAdmin))
      .expect(200);
    expect(list.body).toEqual([
      expect.objectContaining({
        email: PARENT,
        devices: 1,
        children: [expect.objectContaining({ id: studentId, relationship: 'Mother', endedOn: null })],
      }),
    ]);

    const elsewhere = await createSchool(ctx.prisma, 'Another school');
    const otherAdmin = await createStaff(ctx.prisma, [], 'Other admin', [
      { schoolId: elsewhere.schoolId, role: 'SCHOOL_ADMIN' },
    ]);
    const parentId = list.body[0].id as string;
    await request(server()).get(`/api/schools/${schoolId}/parents`).set(asStaff(otherAdmin)).expect(404);
    await request(server())
      .delete(`/api/schools/${elsewhere.schoolId}/parents/${parentId}/sessions`)
      .set(asStaff(otherAdmin))
      .expect(404);

    await request(server())
      .delete(`/api/schools/${schoolId}/parents/${parentId}/sessions`)
      .set(asStaff(schoolAdmin))
      .expect(204);
    expect(await ctx.prisma.parentSession.count({ where: { parentId } })).toBe(0);
  });

  it('checks state, browser binding, nonce and single use', async () => {
    const started = await start();
    await request(server())
      .get('/api/parent/auth/google/callback')
      .query({ state: started.state, code: claims(started.nonce) })
      .expect(302)
      .expect('location', /error=expired/);

    const second = await start();
    const wrongNonce = await callback(second, claims('not-the-nonce'));
    expect(wrongNonce.headers.location).toContain('error=google');
    const reused = await callback(second, claims(second.nonce));
    expect(reused.headers.location).toContain('error=expired');

    const third = await start();
    const otherGoogle = await callback(third, claims(third.nonce, PARENT, 'someone-else'));
    expect(otherGoogle.headers.location).toContain('error=other-account');
  });

  it('only ever returns to the student app after sign-in', async () => {
    const auth = ctx.app.get(ParentAuthService);
    for (const path of ['/\\evil.com', '/\t/evil.com', '//evil.com', 'https://evil.com/x', '/%5Cevil.com'])
      expect(new URL(auth.returnUrl(path)).origin).toBe('http://localhost:3003');
    expect(auth.returnUrl('/units?child=1')).toBe('http://localhost:3003/units?child=1');
  });

  it("replaces this browser's own session when signing in again instead of using a second device", async () => {
    await ctx.prisma.parentSession.deleteMany({});
    const first = await signIn();
    const started = await start();
    const again = await request(server())
      .get('/api/parent/auth/google/callback')
      .query({ state: started.state, code: claims(started.nonce) })
      .set('Cookie', [started.cookie, first.cookie!])
      .expect(302);
    expect(cookieValue(again.headers, 'la_parent')).toBeDefined();
    expect(await ctx.prisma.parentSession.count({ where: { parent: { email: PARENT } } })).toBe(1);
  });

  it('holds the two-device limit when devices sign in at the same moment', async () => {
    await ctx.prisma.parentSession.deleteMany({});
    const results = await Promise.all([signIn(), signIn(), signIn(), signIn()]);
    expect(results.filter((result) => result.cookie).length).toBe(2);
    expect(await ctx.prisma.parentSession.count({ where: { parent: { email: PARENT } } })).toBe(2);
  });

  it('keeps parent and staff sessions apart', async () => {
    await ctx.prisma.parentSession.deleteMany({});
    const { cookie } = await signIn();
    await request(server()).get('/api/me').set('Cookie', cookie!).expect(401);
    await request(server()).get('/api/parent/me').set(asStaff(schoolAdmin)).expect(401);
  });

  it('allows two devices; a third must sign one out first', async () => {
    await ctx.prisma.parentSession.deleteMany({});
    await ctx.prisma.parentSignIn.deleteMany({});
    const phone = await signIn('Mozilla/5.0 (iPhone) Safari/604.1');
    const tablet = await signIn('Mozilla/5.0 (Linux; Android 14) Chrome/141.0');
    expect(phone.cookie && tablet.cookie).toBeTruthy();

    const third = await signIn('Mozilla/5.0 (Windows NT 10.0) Chrome/141.0 Edg/141.0');
    expect(third.cookie).toBeUndefined();
    const token = new URL(third.location).searchParams.get('devices')!;
    const pending = await request(server()).get(`/api/parent/auth/pending/${token}`).expect(200);
    expect(pending.body.newDevice).toBe('Windows · Edge');
    expect(pending.body.devices.map((device: { deviceLabel: string }) => device.deviceLabel).sort()).toEqual([
      'Android · Chrome',
      'iPhone · Safari',
    ]);

    const phoneSession = pending.body.devices.find(
      (device: { deviceLabel: string }) => device.deviceLabel === 'iPhone · Safari',
    );
    const replaced = await request(server())
      .post(`/api/parent/auth/pending/${token}`)
      .send({ signOutSessionId: phoneSession.id })
      .expect(200);
    const computer = cookieValue(replaced.headers, 'la_parent')!;
    await request(server()).get('/api/parent/me').set('Cookie', computer).expect(200);
    await request(server()).get('/api/parent/me').set('Cookie', phone.cookie!).expect(401);
    // The pending sign-in works once.
    await request(server())
      .post(`/api/parent/auth/pending/${token}`)
      .send({ signOutSessionId: phoneSession.id })
      .expect(404);

    const devices = await request(server()).get('/api/parent/devices').set('Cookie', computer).expect(200);
    expect(devices.body).toHaveLength(2);
    expect(devices.body.find((device: { current: boolean }) => device.current).deviceLabel).toBe(
      'Windows · Edge',
    );
  });

  it('locks the parent out as soon as their child leaves', async () => {
    await ctx.prisma.parentSession.deleteMany({});
    const { cookie } = await signIn();
    await request(server()).get('/api/parent/me').set('Cookie', cookie!).expect(200);
    await request(server()).post(`/api/students/${studentId}/leave`).set(asStaff(schoolAdmin)).expect(200);
    await request(server()).get('/api/parent/me').set('Cookie', cookie!).expect(401);
    expect(await ctx.prisma.parentSession.count({ where: { parent: { email: PARENT } } })).toBe(0);
    const again = await signIn();
    expect(again.location).toContain('error=no-active-child');

    // Linked to another child who is still in class: access is back, for that child only.
    await request(server())
      .post(`/api/students/${otherStudentId}/parents`)
      .set(asStaff(schoolAdmin))
      .send({ email: PARENT })
      .expect(201);
    const back = await signIn();
    const me = await request(server()).get('/api/parent/me').set('Cookie', back.cookie!).expect(200);
    expect(me.body.children.map((child: { id: string }) => child.id)).toEqual([otherStudentId]);
  });

  it('keeps a child who left in the school list, and drops one now at another school', async () => {
    const list = await request(server())
      .get(`/api/schools/${schoolId}/parents`)
      .set(asStaff(schoolAdmin))
      .expect(200);
    const children = list.body[0].children as { id: string; endedOn: string | null; endReason: string }[];
    expect(children.find((child) => child.id === studentId)).toMatchObject({ endReason: 'LEFT' });
    expect(children.find((child) => child.id === otherStudentId)).toMatchObject({ endedOn: null });

    const elsewhere = await createSchool(ctx.prisma, 'Next school');
    const level = await ctx.prisma.level.findFirstOrThrow({ where: { number: 2 } });
    const there = await ctx.prisma.class.create({
      data: { campusId: elsewhere.campusId, name: 'Owls', levelId: level.id, schoolYear: '2026-2027' },
    });
    await ctx.prisma.enrollment.create({
      data: { studentId, classId: there.id, startedOn: new Date() },
    });
    const after = await request(server())
      .get(`/api/schools/${schoolId}/parents`)
      .set(asStaff(schoolAdmin))
      .expect(200);
    expect(after.body[0].children.map((child: { id: string }) => child.id)).toEqual([otherStudentId]);
  });

  it('registers parents together with a new child', async () => {
    const klass = await ctx.prisma.class.findFirstOrThrow({ where: { campus: { schoolId }, name: 'Bees' } });
    const created = await request(server())
      .post(`/api/classes/${klass.id}/students`)
      .set(asStaff(schoolAdmin))
      .send({
        displayName: 'Bé Chi',
        parents: [{ email: 'Father@Example.com', relationship: 'Father' }, { email: PARENT }],
      })
      .expect(201);
    const parents = await request(server())
      .get(`/api/students/${created.body.id}/parents`)
      .set(asStaff(schoolAdmin))
      .expect(200);
    expect(parents.body.map((link: { parent: { email: string } }) => link.parent.email)).toEqual([
      'father@example.com',
      PARENT,
    ]);
  });

  it('signs out on logout', async () => {
    await ctx.prisma.parentSession.deleteMany({});
    const { cookie } = await signIn();
    await request(server()).post('/api/parent/auth/logout').set('Cookie', cookie!).expect(200);
    await request(server()).get('/api/parent/me').set('Cookie', cookie!).expect(401);
  });
});
