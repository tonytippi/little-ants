import request from 'supertest';
import { firstValueFrom, take, toArray } from 'rxjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NewScreen } from '@little-ants/shared';
import type { StaffUser } from '../src/auth/staff-access.js';
import { ScreensService } from '../src/screens/screens.service.js';
import { TEST_USER_HEADER, createSchool, createStaff, createTestApp, type TestApp } from './test-app.js';

describe('laptop screens driven by a tablet', () => {
  let ctx: TestApp;
  let teacher: StaffUser;
  let otherTeacher: StaffUser;
  const server = () => ctx.app.getHttpServer();
  const as = (user: StaffUser) => ({ [TEST_USER_HEADER]: user.id });
  const newScreen = async (): Promise<NewScreen> =>
    (await request(server()).post('/api/screens').expect(201)).body as NewScreen;

  beforeAll(async () => {
    ctx = await createTestApp({ headerAuth: true });
    const school = await createSchool(ctx.prisma, 'Screens school');
    teacher = await createStaff(ctx.prisma, [], 'Ms Lan', [{ schoolId: school.schoolId, role: 'TEACHER' }]);
    otherTeacher = await createStaff(ctx.prisma, [], 'Mr Nam', [
      { schoolId: school.schoolId, role: 'TEACHER' },
    ]);
  });

  afterAll(async () => {
    await ctx?.app.close();
  });

  it('opens a screen without sign-in and pairs it once with its code', async () => {
    const screen = await newScreen();
    expect(screen.code).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
    await request(server()).post('/api/screens/pair').send({ code: screen.code }).expect(401);
    await request(server()).post('/api/screens/pair').set(as(teacher)).send({ code: 'nope' }).expect(400);
    const paired = await request(server())
      .post('/api/screens/pair')
      .set(as(teacher))
      .send({ code: screen.code.toLowerCase() })
      .expect(201);
    expect(paired.body).toEqual({ screenId: screen.screenId });
    // A code works once.
    await request(server())
      .post('/api/screens/pair')
      .set(as(otherTeacher))
      .send({ code: screen.code })
      .expect(404);
  });

  it('lets only the pairing teacher send, and only known messages', async () => {
    const screen = await newScreen();
    await request(server())
      .post('/api/screens/pair')
      .set(as(teacher))
      .send({ code: screen.code })
      .expect(201);
    const send = (user: StaffUser, body: object) =>
      request(server()).post(`/api/screens/${screen.screenId}/messages`).set(as(user)).send(body);
    await send(teacher, { type: 'audio', action: 'play' }).expect(204);
    await send(otherTeacher, { type: 'audio', action: 'play' }).expect(403);
    await send(teacher, { type: 'ready' }).expect(400);
    await send(teacher, { type: 'frame', frame: { title: 'x'.repeat(70_000) } }).expect(400);
    await request(server())
      .post('/api/screens/unknown/messages')
      .set(as(teacher))
      .send({ type: 'end' })
      .expect(404);
  });

  it('accepts laptop messages only with its display token', async () => {
    const screen = await newScreen();
    const post = (token: string) =>
      request(server())
        .post(`/api/screens/${screen.screenId}/display-messages`)
        .set('x-display-token', token)
        .send({ type: 'ready' });
    await post('wrong').expect(401);
    await post(screen.displayToken).expect(204);
  });

  it('disconnecting gives the laptop a new code and stops the teacher', async () => {
    const screen = await newScreen();
    await request(server())
      .post('/api/screens/pair')
      .set(as(teacher))
      .send({ code: screen.code })
      .expect(201);
    await request(server()).delete(`/api/screens/${screen.screenId}`).set(as(otherTeacher)).expect(403);
    await request(server()).delete(`/api/screens/${screen.screenId}`).set(as(teacher)).expect(204);
    await request(server())
      .post(`/api/screens/${screen.screenId}/messages`)
      .set(as(teacher))
      .send({ type: 'end' })
      .expect(403);
  });
});

describe('ScreensService streams', () => {
  const user = { id: 'u1', name: 'Ms Lan', email: '', image: null, roles: [], schools: [] } as StaffUser;

  it('relays messages both ways and tells the teacher when the laptop comes and goes', async () => {
    const service = new ScreensService();
    const screen = service.create();
    const display = service.displayStream(screen.screenId, screen.displayToken);
    const displayEvents = firstValueFrom(display.pipe(take(3), toArray()));

    const { screenId } = service.pair(user, screen.code);
    service.toDisplay(user, screenId, { type: 'frame', frame: { title: 'Hello' } });
    expect((await displayEvents).map((event) => event.data)).toEqual([
      { type: 'code', code: screen.code, codeExpiresAt: screen.codeExpiresAt },
      { type: 'paired', teacherName: 'Ms Lan' },
      { type: 'frame', frame: { title: 'Hello' } },
    ]);

    const teacherEvents = firstValueFrom(service.teacherStream(user, screenId).pipe(take(3), toArray()));
    const live = display.subscribe();
    service.toTeacher(screenId, screen.displayToken, { type: 'ready' });
    live.unsubscribe();
    expect((await teacherEvents).map((event) => event.data)).toEqual([
      { type: 'screen-offline' },
      { type: 'screen-online' },
      { type: 'ready' },
    ]);
    service.onModuleDestroy();
  });

  it('closes screens whose laptop left and renews expired codes', () => {
    const service = new ScreensService();
    const left = service.create();
    const waiting = service.create();
    const stream = service.displayStream(waiting.screenId, waiting.displayToken).subscribe();
    service.sweep(Date.now() + 16 * 60_000);
    expect(() => service.pair(user, left.code)).toThrow('not valid');
    expect(() => service.pair(user, waiting.code)).toThrow('not valid');
    expect(() => service.displayStream(left.screenId, left.displayToken)).toThrow('closed');
    stream.unsubscribe();
    service.onModuleDestroy();
  });
});
