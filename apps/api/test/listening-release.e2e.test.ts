import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Prisma } from '@little-ants/db';
import type { ReleaseMedia, UnitReleasePayload } from '@little-ants/shared';
import { ReleaseBuilder } from '../src/releases/release-builder.service.js';
import { createTestApp, type TestApp } from './test-app.js';

const BRIDGE_AUDIO: ReleaseMedia = {
  id: 'asset-u70-sg1',
  kind: 'AUDIO',
  mimeType: 'audio/mpeg',
  url: 'https://media.example/u70-sg1.mp3',
  sizeBytes: 100,
  fileName: 'U70_SG1_Hello-Garden.mp3',
};

/** A stored release of the previous unit, reduced to what the bridge lookup reads. */
function previousRelease(version: number, songTitle: string): Prisma.InputJsonValue {
  const material = (
    code: string,
    type: string,
    title: string,
    media: UnitReleasePayload['materials'][0]['media'],
  ) => ({
    code,
    type,
    title,
    format: '',
    targetLanguage: '',
    fullText: '',
    actions: '',
    teacherNotes: '',
    pages: [],
    media,
  });
  return {
    format: 1,
    version,
    publishedAt: new Date(2026, 9, version).toISOString(),
    unit: { code: 'U70', number: 70, title: 'Previous Hill' },
    canDoGoals: [],
    words: [],
    materials: [
      material('CH1', 'CHANT', 'Clap Clap', []),
      material('RH1', 'RHYME', 'Not a song', []),
      material('SG1', 'SONG', songTitle, [
        { ...BRIDGE_AUDIO, kind: 'IMAGE', id: 'poster', role: 'poster' },
        { ...BRIDGE_AUDIO, role: 'audio' },
      ]),
    ],
    lessons: [],
  } as unknown as Prisma.InputJsonValue;
}

describe('Listening Time in releases', () => {
  let ctx: TestApp;
  let builder: ReleaseBuilder;
  let unitId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    builder = ctx.app.get(ReleaseBuilder);
    const level = await ctx.prisma.level.findFirstOrThrow({ where: { number: 2 } });
    const previous = await ctx.prisma.unit.create({
      data: { levelId: level.id, code: 'U70', number: 70, title: 'Previous Hill' },
    });
    await ctx.prisma.unitRelease.createMany({
      data: [
        {
          unitId: previous.id,
          version: 1,
          payload: previousRelease(1, 'Old title'),
          publishedAt: new Date(2026, 9, 1),
        },
        {
          unitId: previous.id,
          version: 2,
          payload: previousRelease(2, 'Hello Garden'),
          publishedAt: new Date(2026, 9, 2),
        },
      ],
    });
    const unit = await ctx.prisma.unit.create({
      data: { levelId: level.id, code: 'U71', number: 71, title: 'Next Hill' },
    });
    unitId = unit.id;
    const song = await ctx.prisma.material.create({
      data: { unitId, code: 'SG1', type: 'SONG', title: 'Next Song' },
    });
    for (let number = 1; number <= 40; number += 1)
      await ctx.prisma.lesson.create({
        data: {
          unitId,
          number,
          week: Math.ceil(number / 5),
          stage: 'HEAR_IT',
          minutes: 30,
          steps: {
            create: [{ order: 1, minutes: 5, kind: 'SONG', title: 'SG1 Next Song', materialId: song.id }],
          },
        },
      });
  });

  afterAll(async () => {
    await ctx?.app.close();
  });

  it('opens the unit with the previous unit’s latest SG1 as the bridge song', async () => {
    const payload = await builder.build(unitId, 0, new Date());
    const listening = payload.listening!;
    expect(listening.leaves).toHaveLength(40);
    expect(listening.bridge).toEqual({
      unitCode: 'U70',
      materialCode: 'SG1',
      title: 'Hello Garden',
      audio: BRIDGE_AUDIO,
    });
    for (const leaf of listening.leaves.slice(0, 5))
      expect(leaf.items[0]).toMatchObject({ kind: 'lookBack', materialCode: 'SG1', unitCode: 'U70' });
    // Leaves 6–8 play another favourite of the previous unit: its only other song is CH1.
    for (const leaf of listening.leaves.slice(5, 8))
      expect(leaf.items[0]).toMatchObject({ kind: 'lookBack', materialCode: 'CH1', audio: null });
    for (const leaf of listening.leaves)
      for (const item of leaf.items) if (item.kind === 'material') expect(item.code).toBe('SG1');
  });
});
