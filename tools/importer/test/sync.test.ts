import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, seedBaseData, type PrismaClient } from '@little-ants/db';
import { resetTestDatabase } from '@little-ants/db/testing';
import { LocalStorage } from '@little-ants/storage';
import { importUnitMedia } from '../src/assets.js';
import { planUnitMedia, type MediaSources } from '../src/media-plan.js';
import { failInterruptedRuns, processNextRun } from '../src/worker.js';

let prisma: PrismaClient;
const temp = mkdtempSync(path.join(os.tmpdir(), 'la-sync-test-'));

beforeAll(async () => {
  prisma = createPrismaClient(await resetTestDatabase('test_sync'));
  await seedBaseData(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
  rmSync(temp, { recursive: true, force: true });
});

describe('unit files on re-import', () => {
  it('sets importer links and word pictures to what the source holds and keeps files attached in Admin', async () => {
    const level = await prisma.level.findFirstOrThrow();
    const unit = await prisma.unit.create({ data: { levelId: level.id, code: 'U90', number: 90, title: 'Sync test' } });
    const materials = [
      { code: 'ST1', type: 'STORY' as const },
      { code: 'SG1', type: 'SONG' as const },
    ];
    const [story, song] = await Promise.all(materials.map((m) => prisma.material.create({ data: { unitId: unit.id, title: m.code, ...m } })));
    const words = [{ cardId: 'U90-01', text: 'apple' }];
    const word = await prisma.word.create({ data: { unitId: unit.id, order: 1, ...words[0]! } });
    const manual = await prisma.asset.create({
      data: { kind: 'PDF', storageKey: 'manual/layout.pdf', fileName: 'layout.pdf', mimeType: 'application/pdf', sizeBytes: 1 },
    });
    await prisma.materialAsset.create({ data: { materialId: story!.id, assetId: manual.id, role: 'draft-layout' } });
    const storage = new LocalStorage({ rootDir: path.join(temp, 'storage'), baseUrl: 'http://localhost/storage', signingSecret: 'secret' });
    const file = (name: string, body: string): string => {
      const full = path.join(temp, name);
      writeFileSync(full, body);
      return full;
    };
    const plan = (sources: Partial<Pick<MediaSources, 'draftDesigns' | 'finalFiles' | 'audio'>>) =>
      planUnitMedia({ unitCode: 'U90', draftDesigns: [], finalFiles: [], audio: [], materials, words, ...sources });
    const links = async (materialId: string): Promise<string[]> =>
      (await prisma.materialAsset.findMany({ where: { materialId }, include: { asset: true }, orderBy: [{ role: 'asc' }, { order: 'asc' }] })).map(
        (link) => `${link.role}:${link.asset.source}:${link.asset.fileName}`,
      );

    const first = await importUnitMedia(
      prisma,
      storage,
      unit.id,
      plan({
        draftDesigns: [file('U90_ST1_Story_DRAFT.pdf', 'story v1'), file('U90_POSTERS_Songs_DRAFT.pdf', 'posters v1')],
        finalFiles: [
          file('U90-WC-01_apple.png', 'apple'),
          file('U90_SG1_panel2_b.jpg', 'b'),
          file('U90_SG1_panel1_a.jpg', 'a'),
          file('U90_UC_Cover.jpg', 'cover'),
          file('U90_PLACE_garden.jpg', 'garden'),
        ],
        audio: [file('U90_SG1_Song_audio_v1.0.mp3', 'song')],
      }),
    );
    expect(first).toEqual({ linked: { 'draft-layout': 2, poster: 2, audio: 1, cover: 1, place: 1, word: 1 }, removed: 0 });
    const pictures = await prisma.unitAsset.findMany({ where: { unitId: unit.id }, include: { asset: true }, orderBy: { role: 'asc' } });
    expect(pictures.map((row) => `${row.role}:${row.label}:${row.asset.fileName}`)).toEqual(['cover::U90_UC_Cover.jpg', 'place:garden:U90_PLACE_garden.jpg']);
    expect(await links(song!.id)).toEqual([
      'audio:import:U90_SG1_Song_audio_v1.0.mp3',
      'draft-layout:import:U90_POSTERS_Songs_DRAFT.pdf',
      'poster:import:U90_SG1_panel1_a.jpg',
      'poster:import:U90_SG1_panel2_b.jpg',
    ]);
    expect((await prisma.word.findUniqueOrThrow({ where: { id: word.id }, include: { imageAsset: true } })).imageAsset?.fileName).toBe('U90-WC-01_apple.png');

    // On the source: the story layout changed, the posters file, the song pictures and the word picture were removed.
    const second = await importUnitMedia(prisma, storage, unit.id, plan({ draftDesigns: [file('U90_ST1_Story_DRAFT.pdf', 'story v2')] }));
    expect(second).toEqual({ linked: { 'draft-layout': 1 }, removed: 8 });
    expect(await prisma.unitAsset.count({ where: { unitId: unit.id } })).toBe(0);
    expect((await links(story!.id)).sort()).toEqual(['draft-layout:import:U90_ST1_Story_DRAFT.pdf', 'draft-layout:upload:layout.pdf']);
    expect(await links(song!.id)).toEqual([]);
    expect((await prisma.word.findUniqueOrThrow({ where: { id: word.id } })).imageAssetId).toBeNull();
  });
});

describe('import worker', () => {
  it('runs the oldest queued request and stores the report', async () => {
    const older = await prisma.importRun.create({ data: { createdAt: new Date('2026-01-01') } });
    const newer = await prisma.importRun.create({ data: {} });
    let ran = 0;
    expect(
      await processNextRun(prisma, async (log) => {
        ran += 1;
        log('U01: 40 lessons');
        return { report: '# Report', archive: 'sources/x' };
      }),
    ).toBe(true);
    expect(ran).toBe(1);
    expect(await prisma.importRun.findUniqueOrThrow({ where: { id: older.id } })).toMatchObject({
      status: 'SUCCEEDED',
      report: '# Report',
      archive: 'sources/x',
      message: 'Finished',
    });
    expect((await prisma.importRun.findUniqueOrThrow({ where: { id: newer.id } })).status).toBe('QUEUED');

    expect(
      await processNextRun(prisma, async () => {
        throw new Error('Google Drive request failed (HTTP 404): File not found');
      }),
    ).toBe(true);
    const failed = await prisma.importRun.findUniqueOrThrow({ where: { id: newer.id } });
    expect(failed.status).toBe('FAILED');
    expect(failed.message).toContain('File not found');
    expect(failed.finishedAt).not.toBeNull();

    expect(await processNextRun(prisma, async () => ({ report: '', archive: null }))).toBe(false);
  });

  it('marks runs interrupted by a restart as failed', async () => {
    const stuck = await prisma.importRun.create({ data: { status: 'RUNNING', startedAt: new Date() } });
    expect(await failInterruptedRuns(prisma)).toBe(1);
    expect((await prisma.importRun.findUniqueOrThrow({ where: { id: stuck.id } })).status).toBe('FAILED');
  });
});
