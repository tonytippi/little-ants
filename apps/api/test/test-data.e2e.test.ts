import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ObjectStorage } from '@little-ants/storage';
import { TEST_CAMPUS, TEST_CLASS, seedTestData } from '../src/cli/test-data.js';
import { ContentService } from '../src/content/content.service.js';
import { ReleaseBuilder } from '../src/releases/release-builder.service.js';
import { OBJECT_STORAGE } from '../src/storage/storage.tokens.js';
import { createStaff, createTestApp, type TestApp } from './test-app.js';

describe('test data seed', () => {
  let ctx: TestApp;
  let run: () => ReturnType<typeof seedTestData>;
  let storage: ObjectStorage;
  let materialId: string;
  let assetId: string;
  const storageKey = 'assets/test-data/poster.png';

  beforeAll(async () => {
    ctx = await createTestApp();
    storage = ctx.app.get<ObjectStorage>(OBJECT_STORAGE);
    const content = ctx.app.get(ContentService);
    const releases = ctx.app.get(ReleaseBuilder);
    run = () => seedTestData(content, releases, { id: null, roles: ['ADMIN'] });
    await createStaff(ctx.prisma, ['TEACHER'], 'Teacher');

    const level = await ctx.prisma.level.findFirstOrThrow({ where: { number: 2 } });
    const unit = await ctx.prisma.unit.create({
      data: { levelId: level.id, code: 'U05', number: 5, title: 'Yummy Garden' },
    });
    await storage.put(storageKey, new TextEncoder().encode('png'), 'image/png');
    const asset = await ctx.prisma.asset.create({
      data: { kind: 'IMAGE', storageKey, fileName: 'poster.png', mimeType: 'image/png', sizeBytes: 3 },
    });
    assetId = asset.id;
    const material = await ctx.prisma.material.create({
      data: {
        unitId: unit.id,
        code: 'SG1',
        type: 'SONG',
        title: 'In Our Yummy Garden',
        assets: { create: { assetId, role: 'poster' } },
      },
    });
    materialId = material.id;
    await ctx.prisma.word.create({ data: { unitId: unit.id, cardId: 'U05-01', text: 'apple', order: 1 } });
    for (let number = 1; number <= 40; number += 1) {
      await ctx.prisma.lesson.create({
        data: {
          unitId: unit.id,
          number,
          week: Math.ceil(number / 4),
          stage: 'HEAR_IT',
          minutes: 30,
          steps: { create: [{ order: 1, minutes: 5, kind: 'SONG', title: 'SG1', materialId }] },
        },
      });
    }
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('approves the imported unit with its files, publishes it and sets up the Unit 5 class', async () => {
    const result = await run();
    expect(result.published.U05).toBe(1);
    expect(result.blocked.U05).toBeUndefined();

    const unit = await ctx.prisma.unit.findUniqueOrThrow({
      where: { code: 'U05' },
      include: { materials: true, lessons: true, words: true },
    });
    const statuses = new Set([
      unit.status,
      ...unit.materials.map((item) => item.status),
      ...unit.lessons.map((item) => item.status),
      ...unit.words.map((item) => item.status),
    ]);
    expect([...statuses]).toEqual(['APPROVED']);
    expect((await ctx.prisma.asset.findUniqueOrThrow({ where: { id: assetId } })).status).toBe('APPROVED');
    const release = await ctx.prisma.unitRelease.findFirstOrThrow({ where: { unitId: unit.id } });
    const payload = release.payload as { materials: { media: { id: string }[] }[] };
    expect(payload.materials[0]!.media.map((media) => media.id)).toEqual([assetId]);

    const testClass = await ctx.prisma.class.findUniqueOrThrow({
      where: { id: result.classId },
      include: { campus: true, teachers: true, students: true },
    });
    expect(testClass).toMatchObject({ name: TEST_CLASS, currentUnitId: unit.id, levelId: unit.levelId });
    expect(testClass.campus.name).toBe(TEST_CAMPUS);
    expect(testClass.teachers.length).toBe(result.teachers);
    expect(result.teachers).toBeGreaterThan(0);
    expect(testClass.students).toHaveLength(8);
  });

  it('does nothing new when run again, and keeps lesson progress and children', async () => {
    await ctx.prisma.class.updateMany({ where: { name: TEST_CLASS }, data: { nextLesson: 7 } });
    const result = await run();
    expect(result.approved.U05).toBe(0);
    expect(result.published.U05).toBeUndefined();
    const testClass = await ctx.prisma.class.findUniqueOrThrow({
      where: { id: result.classId },
      include: { students: true },
    });
    expect(testClass.nextLesson).toBe(7);
    expect(testClass.students).toHaveLength(8);
    expect(await ctx.prisma.campus.count({ where: { name: TEST_CAMPUS } })).toBe(1);
  });

  it('approves and publishes again after a new import changed the unit', async () => {
    await ctx.prisma.material.update({
      where: { id: materialId },
      data: { status: 'DRAFT', title: 'New title' },
    });
    const result = await run();
    expect(result.approved.U05).toBe(1);
    expect(result.published.U05).toBe(2);
  });
});
