import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, seedBaseData, type PrismaClient } from '@little-ants/db';
import { resetTestDatabase } from '@little-ants/db/testing';
import { LocalStorage } from '@little-ants/storage';
import { importDraftDesigns } from '../src/assets.js';
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

describe('draft layouts on re-import', () => {
  it('replaces the importer links with the files now in the folder and keeps files attached in Admin', async () => {
    const level = await prisma.level.findFirstOrThrow();
    const unit = await prisma.unit.create({ data: { levelId: level.id, code: 'U90', number: 90, title: 'Sync test' } });
    const story = await prisma.material.create({ data: { unitId: unit.id, code: 'ST1', type: 'STORY', title: 'Story' } });
    const song = await prisma.material.create({ data: { unitId: unit.id, code: 'SG1', type: 'SONG', title: 'Song' } });
    const manual = await prisma.asset.create({
      data: { kind: 'PDF', storageKey: 'manual/layout.pdf', fileName: 'layout.pdf', mimeType: 'application/pdf', sizeBytes: 1 },
    });
    await prisma.materialAsset.create({ data: { materialId: story.id, assetId: manual.id, role: 'draft-layout' } });
    const storage = new LocalStorage({ rootDir: path.join(temp, 'storage'), baseUrl: 'http://localhost/storage', signingSecret: 'secret' });
    const file = (name: string, body: string): string => {
      const full = path.join(temp, name);
      writeFileSync(full, body);
      return full;
    };
    const imported = async (materialId: string): Promise<string[]> =>
      (await prisma.materialAsset.findMany({ where: { materialId, role: 'draft-layout' }, include: { asset: true } }))
        .map((link) => `${link.asset.source}:${link.asset.fileName}`)
        .sort();

    const first = await importDraftDesigns(prisma, storage, unit.id, [
      file('U90_ST1_Story_DRAFT.pdf', 'story v1'),
      file('U90_POSTERS_Songs_DRAFT.pdf', 'posters v1'),
    ]);
    expect(first).toMatchObject({ linked: 2, removed: 0 });

    // The story layout changed on Drive and the posters file was removed.
    const second = await importDraftDesigns(prisma, storage, unit.id, [file('U90_ST1_Story_DRAFT.pdf', 'story v2')]);
    expect(second).toMatchObject({ linked: 1, removed: 2 });
    expect(await imported(story.id)).toEqual(['import:U90_ST1_Story_DRAFT.pdf', 'upload:layout.pdf']);
    expect(await imported(song.id)).toEqual([]);
    const storyLink = await prisma.materialAsset.findFirstOrThrow({ where: { materialId: story.id, asset: { source: 'import' } }, include: { asset: true } });
    expect(storyLink.asset.sizeBytes).toBe('story v2'.length);
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
