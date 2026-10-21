import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { UnitReleasePayload } from '@little-ants/shared';
import type { StaffUser } from '../src/auth/staff-access.js';
import { TEST_USER_HEADER, createStaff, createTestApp, type TestApp } from './test-app.js';

const UNIT = 'U90';

describe('content editing, review, publishing and teaching', () => {
  let ctx: TestApp;
  let author: StaffUser;
  let reviewer: StaffUser;
  let teacher: StaffUser;
  let materialId: string;
  let lessonId: string;
  let classId: string;
  let studentId: string;
  const as = (user: StaffUser) => ({ [TEST_USER_HEADER]: user.id });
  const server = () => ctx.app.getHttpServer();

  beforeAll(async () => {
    ctx = await createTestApp({ headerAuth: true });
    author = await createStaff(ctx.prisma, ['AUTHOR'], 'Author');
    reviewer = await createStaff(ctx.prisma, ['REVIEWER'], 'Reviewer');
    teacher = await createStaff(ctx.prisma, ['TEACHER'], 'Teacher');

    const level = await ctx.prisma.level.findFirstOrThrow({ where: { number: 1 } });
    const unit = await ctx.prisma.unit.create({ data: { levelId: level.id, code: UNIT, number: 90, title: 'Test Hill' } });
    const material = await ctx.prisma.material.create({
      data: { unitId: unit.id, code: 'SG1', type: 'SONG', title: 'Hello song', fullText: 'Hello, hello!' },
    });
    materialId = material.id;
    const lesson = await ctx.prisma.lesson.create({
      data: {
        unitId: unit.id,
        number: 1,
        week: 1,
        stage: 'HEAR_IT',
        minutes: 25,
        steps: { create: [{ order: 1, minutes: 5, kind: 'SONG', title: 'SG1 Hello song', materialId }] },
      },
    });
    lessonId = lesson.id;
    // A unit needs all 40 lessons before it can be published.
    for (let number = 2; number <= 40; number += 1) {
      await ctx.prisma.lesson.create({
        data: {
          unitId: unit.id,
          number,
          week: Math.ceil(number / 5),
          stage: 'JOIN_IN',
          minutes: 25,
          steps: { create: [{ order: 1, minutes: 5, kind: 'SONG', title: 'SG1 Hello song', materialId }] },
        },
      });
    }
    await ctx.prisma.canDoGoal.create({ data: { unitId: unit.id, order: 1, text: 'say hello' } });
    await ctx.prisma.word.create({ data: { unitId: unit.id, cardId: `${UNIT}-01`, order: 1, text: 'hello', pictureBrief: 'waving ant' } });

    const campus = await ctx.prisma.campus.create({ data: { name: 'Content test campus' } });
    const klass = await ctx.prisma.class.create({
      data: { campusId: campus.id, name: 'Bees', levelId: level.id, schoolYear: '2026-2027', currentUnitId: unit.id, teachers: { create: { userId: teacher.id } } },
    });
    classId = klass.id;
    studentId = (await ctx.prisma.student.create({ data: { classId, displayName: 'Bé Na' } })).id;
  });

  afterAll(async () => {
    await ctx?.app.close();
  });

  it('lists units with progress and opens a unit', async () => {
    const list = await request(server()).get('/api/content/units').set(as(author)).expect(200);
    expect(list.body.units.map((unit: { code: string }) => unit.code)).toContain(UNIT);
    const detail = await request(server()).get(`/api/content/units/${UNIT}`).set(as(author)).expect(200);
    expect(detail.body.lessons).toHaveLength(40);
  });

  it('keeps teachers out of content editing', async () => {
    await request(server()).patch(`/api/content/materials/${materialId}`).set(as(teacher)).send({ title: 'x' }).expect(403);
  });

  it('blocks publishing until everything is approved', async () => {
    const check = await request(server()).get(`/api/content/units/${UNIT}/release-check`).set(as(reviewer)).expect(200);
    expect(check.body.blockers.length).toBeGreaterThan(0);
    await request(server()).post(`/api/content/units/${UNIT}/releases`).set(as(reviewer)).send({}).expect(409);
  });

  it('runs the review flow: authors submit, only reviewers approve', async () => {
    const submitted = await request(server()).post(`/api/content/units/${UNIT}/submit-all`).set(as(author)).expect(201);
    expect(submitted.body).toMatchObject({ unit: 1, word: 1, material: 1, lesson: 40 });
    await request(server()).post(`/api/content/units/${UNIT}/approve-all`).set(as(author)).expect(403);
    await request(server()).post(`/api/content/units/${UNIT}/approve-all`).set(as(reviewer)).expect(201);
  });

  it('reopens approved content as a new draft version when edited, and can restore history', async () => {
    const edited = await request(server())
      .patch(`/api/content/materials/${materialId}`)
      .set(as(author))
      .send({ fullText: 'Hello, friends!' })
      .expect(200);
    expect(edited.body).toMatchObject({ status: 'DRAFT', version: 2 });

    const history = await request(server()).get(`/api/content/revisions?entityType=material&entityId=${materialId}`).set(as(author)).expect(200);
    const approvedV1 = history.body.find((rev: { version: number; snapshot: { status: string } }) => rev.version === 1 && rev.snapshot.status === 'APPROVED');
    const restored = await request(server()).post(`/api/content/revisions/${approvedV1.id}/restore`).set(as(author)).expect(201);
    expect(restored.body).toMatchObject({ fullText: 'Hello, hello!', status: 'DRAFT', version: 2 });

    await request(server()).post(`/api/content/materials/${materialId}/status`).set(as(author)).send({ status: 'REVIEW' }).expect(201);
    await request(server()).post(`/api/content/materials/${materialId}/status`).set(as(reviewer)).send({ status: 'APPROVED' }).expect(201);
  });

  it('saves a whole lesson and refuses materials from other units', async () => {
    const lesson = await request(server()).get(`/api/content/lessons/${lessonId}`).set(as(author)).expect(200);
    const body = {
      week: 1,
      stage: 'HEAR_IT',
      minutes: 25,
      newToday: ['SG1'],
      goals: ['listen and wave'],
      keyLanguage: 'Hello!',
      support: '',
      challenge: '',
      lookFor: '',
      homeLink: '',
      prepMinutes: 10,
      notes: '',
      steps: [
        { minutes: 3, kind: 'HELLO_CIRCLE', title: 'Hello Circle', materialId: null, teacherText: 'Wave.', childrenText: 'Wave back.' },
        { ...lesson.body.steps[0], materialId, teacherText: 'Sing twice.', childrenText: '' },
      ].map(({ minutes, kind, title, materialId: mid, teacherText, childrenText }) => ({ minutes, kind, title, materialId: mid, teacherText, childrenText })),
      prep: [{ text: 'SG1 poster', materialId }],
    };
    const saved = await request(server()).put(`/api/content/lessons/${lessonId}`).set(as(author)).send(body).expect(200);
    expect(saved.body.steps).toHaveLength(2);
    expect(saved.body.status).toBe('DRAFT');
    expect(saved.body.version).toBe(2);

    const level = await ctx.prisma.level.findFirstOrThrow();
    const otherUnit = await ctx.prisma.unit.create({ data: { levelId: level.id, code: 'U91', number: 91, title: 'Other' } });
    const other = await ctx.prisma.material.create({ data: { unitId: otherUnit.id, code: 'SG1', type: 'SONG', title: 'Other' } });
    await request(server())
      .put(`/api/content/lessons/${lessonId}`)
      .set(as(author))
      .send({ ...body, steps: [{ ...body.steps[0], materialId: other.id }] })
      .expect(400);

    await request(server()).post(`/api/content/lessons/${lessonId}/status`).set(as(author)).send({ status: 'REVIEW' }).expect(201);
    await request(server()).post(`/api/content/lessons/${lessonId}/status`).set(as(reviewer)).send({ status: 'APPROVED' }).expect(201);
  });

  it('uploads a file through a signed URL, approves it and replaces it with a new version', async () => {
    const start = await request(server())
      .post('/api/assets/upload-url')
      .set(as(author))
      .send({ fileName: 'Hello Poster.png', mimeType: 'image/png', sizeBytes: 4 })
      .expect(201);
    const uploadPath = new URL(start.body.uploadUrl).pathname + new URL(start.body.uploadUrl).search;
    await request(server()).put(uploadPath).set('Content-Type', 'image/png').send(Buffer.from([1, 2, 3, 4])).expect(200);
    await request(server()).put(uploadPath).set('Content-Type', 'text/html').send('<b>x</b>').expect(403);
    const completed = await request(server()).post(`/api/assets/${start.body.assetId}/complete`).set(as(author)).expect(201);
    expect(completed.body).toMatchObject({ uploaded: true, sizeBytes: 4, status: 'DRAFT' });
    // A retried "complete" returns the same finished asset.
    const retried = await request(server()).post(`/api/assets/${start.body.assetId}/complete`).set(as(author)).expect(201);
    expect(retried.body).toMatchObject({ id: start.body.assetId, uploaded: true });

    await request(server()).put(`/api/content/materials/${materialId}/assets`).set(as(author)).send({ role: 'poster', assetIds: [start.body.assetId] }).expect(200);
    const detail = await request(server()).get(`/api/content/materials/${materialId}`).set(as(author)).expect(200);
    expect(detail.body.assets[0].asset.url).toContain('/api/storage/read/');

    // Drafts are not public.
    const key = new URL(completed.body.url).pathname.replace('/api/storage/read/', '');
    await request(server()).get(`/api/storage/public/${key}`).expect(404);
    await request(server()).post(`/api/assets/${start.body.assetId}/status`).set(as(author)).send({ status: 'REVIEW' }).expect(201);
    await request(server()).post(`/api/assets/${start.body.assetId}/status`).set(as(author)).send({ status: 'APPROVED' }).expect(403);
    await request(server()).post(`/api/assets/${start.body.assetId}/status`).set(as(reviewer)).send({ status: 'APPROVED' }).expect(201);
    const file = await request(server()).get(`/api/storage/public/${key}`).expect(200);
    expect(file.headers['cache-control']).toContain('immutable');

    const replace = await request(server())
      .post('/api/assets/upload-url')
      .set(as(author))
      .send({ fileName: 'Hello Poster.png', mimeType: 'image/png', sizeBytes: 2, replacesId: start.body.assetId })
      .expect(201);
    const replacePath = new URL(replace.body.uploadUrl).pathname + new URL(replace.body.uploadUrl).search;
    await request(server()).put(replacePath).set('Content-Type', 'image/png').send(Buffer.from([9, 9])).expect(200);
    const v2 = await request(server()).post(`/api/assets/${replace.body.assetId}/complete`).set(as(author)).expect(201);
    expect(v2.body).toMatchObject({ version: 2, previousId: start.body.assetId });
    expect(v2.body.olderVersions).toHaveLength(1);
    const links = await ctx.prisma.materialAsset.findMany({ where: { materialId } });
    expect(links.map((link) => link.assetId)).toEqual([replace.body.assetId]);
    // The material now shows a different file, so it is a new draft with a revision saying why.
    const reopened = await ctx.prisma.material.findUniqueOrThrow({ where: { id: materialId } });
    expect(reopened.status).toBe('DRAFT');
    expect(await ctx.prisma.revision.count({ where: { entityId: materialId, note: 'file replaced by a new version' } })).toBe(1);
    // Calling complete again on the new version does not break the version chain.
    await request(server()).post(`/api/assets/${replace.body.assetId}/complete`).set(as(author)).expect(201);
    expect((await ctx.prisma.asset.findUniqueOrThrow({ where: { id: replace.body.assetId } })).previousId).toBe(start.body.assetId);

    // Put the approved version back so the release below has a public file.
    await request(server()).put(`/api/content/materials/${materialId}/assets`).set(as(author)).send({ role: 'poster', assetIds: [start.body.assetId] }).expect(200);
    await request(server()).post(`/api/content/materials/${materialId}/status`).set(as(author)).send({ status: 'REVIEW' }).expect(201);
    await request(server()).post(`/api/content/materials/${materialId}/status`).set(as(reviewer)).send({ status: 'APPROVED' }).expect(201);
  });

  it('publishes the unit and serves the release to teachers', async () => {
    const published = await request(server()).post(`/api/content/units/${UNIT}/releases`).set(as(reviewer)).send({ note: 'pilot' }).expect(201);
    expect(published.body).toEqual({ version: 1 });

    const classes = await request(server()).get('/api/teach/classes').set(as(teacher)).expect(200);
    expect(classes.body[0]).toMatchObject({ name: 'Bees', currentUnit: { code: UNIT, release: { version: 1 } } });

    const release = await request(server()).get(`/api/teach/units/${UNIT}/release`).set(as(teacher)).expect(200);
    const payload = release.body as UnitReleasePayload;
    expect(payload.version).toBe(1);
    expect(payload.lessons[0]!.steps.map((step) => step.materialCode)).toEqual([null, 'SG1']);
    expect(payload.materials[0]!.media[0]).toMatchObject({ role: 'poster', kind: 'IMAGE' });
    expect(payload.canDoGoals).toEqual([{ order: 1, text: 'say hello' }]);
  });

  it('syncs offline records once, moves the class on and ignores children from other classes', async () => {
    const run = {
      clientId: crypto.randomUUID(),
      classId,
      unitCode: UNIT,
      lessonNumber: 1,
      releaseVersion: 1,
      taughtAt: new Date().toISOString(),
      notes: 'Children loved the song.',
    };
    const observation = {
      clientId: crypto.randomUUID(),
      studentId,
      classId,
      unitCode: UNIT,
      goalOrder: 1,
      level: 'WITH_HELP',
      lessonNumber: 1,
      observedAt: new Date().toISOString(),
    };
    const level = await ctx.prisma.level.findFirstOrThrow();
    const elsewhere = await ctx.prisma.campus.create({ data: { name: 'Elsewhere' } });
    const otherClass = await ctx.prisma.class.create({ data: { campusId: elsewhere.id, name: 'X', levelId: level.id, schoolYear: '2026-2027' } });
    const outsider = await ctx.prisma.student.create({ data: { displayName: 'Other', classId: otherClass.id } });
    const body = { lessonRuns: [run], observations: [observation, { ...observation, clientId: crypto.randomUUID(), studentId: outsider.id }] };

    const first = await request(server()).post('/api/teach/sync').set(as(teacher)).send(body).expect(201);
    expect(first.body.accepted).toEqual([run.clientId, observation.clientId]);
    expect(first.body.rejected).toEqual([{ clientId: body.observations[1]!.clientId, reason: 'The child is not in this class' }]);
    const again = await request(server()).post('/api/teach/sync').set(as(teacher)).send(body).expect(201);
    expect(again.body.accepted).toEqual([run.clientId, observation.clientId]);
    expect(await ctx.prisma.lessonRun.count({ where: { clientId: run.clientId } })).toBe(1);

    // An admin moves the class back; replaying the old record must not move it forward again.
    await ctx.prisma.class.update({ where: { id: classId }, data: { nextLesson: 1 } });
    await request(server()).post('/api/teach/sync').set(as(teacher)).send(body).expect(201);
    expect((await ctx.prisma.class.findUniqueOrThrow({ where: { id: classId } })).nextLesson).toBe(1);
    await ctx.prisma.class.update({ where: { id: classId }, data: { nextLesson: 2 } });

    expect((await ctx.prisma.class.findUniqueOrThrow({ where: { id: classId } })).nextLesson).toBe(2);
    const results = await request(server()).get(`/api/teach/classes/${classId}/observations?unit=${UNIT}`).set(as(teacher)).expect(200);
    expect(results.body).toEqual([expect.objectContaining({ studentId, goalOrder: 1, level: 'WITH_HELP' })]);

    const notes = await request(server()).get(`/api/content/units/${UNIT}/teacher-notes`).set(as(author)).expect(200);
    expect(notes.body[0]).toMatchObject({ notes: 'Children loved the song.', class: { name: 'Bees' } });
  });

  it('stops other teachers syncing into a class that is not theirs, record by record', async () => {
    const stranger = await createStaff(ctx.prisma, ['TEACHER'], 'Stranger');
    const clientId = crypto.randomUUID();
    const response = await request(server())
      .post('/api/teach/sync')
      .set(as(stranger))
      .send({ lessonRuns: [{ clientId, classId, unitCode: UNIT, lessonNumber: 2, releaseVersion: 1, taughtAt: new Date().toISOString() }] })
      .expect(201);
    expect(response.body).toEqual({ accepted: [], rejected: [{ clientId, reason: 'Not your class' }] });
    expect(await ctx.prisma.lessonRun.count({ where: { clientId } })).toBe(0);
  });

  it('keeps teacher notes and draft content away from teachers', async () => {
    await request(server()).get(`/api/content/units/${UNIT}/teacher-notes`).set(as(teacher)).expect(403);
    await request(server()).get(`/api/content/units/${UNIT}`).set(as(teacher)).expect(403);
    await request(server()).get('/api/assets').set(as(teacher)).expect(403);
  });
});
