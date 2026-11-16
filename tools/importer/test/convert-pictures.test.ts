import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, seedBaseData, type PrismaClient } from '@little-ants/db';
import { resetTestDatabase } from '@little-ants/db/testing';
import { LocalStorage } from '@little-ants/storage';
import { convertPicturesToWebp } from '../src/convert-pictures.js';

let prisma: PrismaClient;
const temp = mkdtempSync(path.join(os.tmpdir(), 'la-convert-test-'));

beforeAll(async () => {
  prisma = createPrismaClient(await resetTestDatabase('test_convert'));
  await seedBaseData(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
  rmSync(temp, { recursive: true, force: true });
});

describe('converting stored pictures to WebP', () => {
  it('converts PNG and JPEG pictures, points releases at them and skips files it cannot read', async () => {
    const storage = new LocalStorage({
      rootDir: path.join(temp, 'storage'),
      baseUrl: 'http://localhost/storage',
      signingSecret: 'secret',
    });
    const png = await sharp({ create: { width: 3000, height: 2000, channels: 4, background: '#335588' } })
      .png()
      .toBuffer();
    const picture = async (fileName: string, body: Buffer, status: 'APPROVED' | 'DRAFT' = 'APPROVED') => {
      const storageKey = `assets/${fileName}/v1/${fileName.toLowerCase()}`;
      await storage.put(storageKey, body);
      return prisma.asset.create({
        data: {
          kind: 'IMAGE',
          storageKey,
          fileName,
          mimeType: 'image/png',
          sizeBytes: body.length,
          status,
        },
      });
    };
    const cover = await picture('Cover.png', png);
    const draft = await picture('Draft.png', png, 'DRAFT');
    const broken = await picture('Broken.png', Buffer.from('not a picture'));
    const missing = await prisma.asset.create({
      data: {
        kind: 'IMAGE',
        storageKey: 'assets/gone/v1/gone.png',
        fileName: 'gone.png',
        mimeType: 'image/png',
        sizeBytes: 1,
        status: 'APPROVED',
      },
    });
    const entry = (asset: typeof cover) => ({
      id: asset.id,
      kind: 'IMAGE',
      mimeType: asset.mimeType,
      url: storage.publicUrl(asset.storageKey),
      sizeBytes: asset.sizeBytes,
      fileName: asset.fileName,
    });
    const level = await prisma.level.findFirstOrThrow();
    const unit = await prisma.unit.create({
      data: { levelId: level.id, code: 'U92', number: 92, title: 'Convert test' },
    });
    const release = await prisma.unitRelease.create({
      data: {
        unitId: unit.id,
        version: 1,
        payload: { unit: { cover: entry(cover), pictures: [{ label: 'x', image: entry(broken) }] } },
      },
    });

    expect(await convertPicturesToWebp(prisma, storage, { apply: false })).toMatchObject({
      pictures: 4,
      converted: 0,
    });
    expect((await prisma.asset.findUniqueOrThrow({ where: { id: cover.id } })).mimeType).toBe('image/png');

    const result = await convertPicturesToWebp(prisma, storage, { apply: true });
    expect(result).toMatchObject({
      pictures: 4,
      converted: 2,
      missing: [missing.storageKey],
      unreadable: [broken.storageKey],
      releasesUpdated: 1,
    });
    expect(result.bytesAfter).toBeLessThan(result.bytesBefore);

    const converted = await prisma.asset.findUniqueOrThrow({ where: { id: cover.id } });
    expect(converted).toMatchObject({
      fileName: 'Cover.webp',
      mimeType: 'image/webp',
      storageKey: `assets/${cover.id}/v1/cover.webp`,
    });
    expect(await storage.head(cover.storageKey)).toBeNull();
    const stored = await storage.get(converted.storageKey);
    expect(stored?.length).toBe(converted.sizeBytes);
    expect(await sharp(stored!).metadata()).toMatchObject({ format: 'webp', width: 1920, height: 1280 });
    expect((await prisma.asset.findUniqueOrThrow({ where: { id: draft.id } })).mimeType).toBe('image/webp');

    const payload = (await prisma.unitRelease.findUniqueOrThrow({ where: { id: release.id } })).payload as {
      unit: { cover: Record<string, unknown>; pictures: { image: Record<string, unknown> }[] };
    };
    expect(payload.unit.cover).toEqual({
      id: cover.id,
      kind: 'IMAGE',
      mimeType: 'image/webp',
      url: storage.publicUrl(converted.storageKey),
      sizeBytes: converted.sizeBytes,
      fileName: 'Cover.webp',
    });
    // A picture that stayed PNG keeps its entry.
    expect(payload.unit.pictures[0]!.image).toEqual(entry(broken));

    expect(await convertPicturesToWebp(prisma, storage, { apply: true })).toMatchObject({
      pictures: 2,
      converted: 0,
      releasesUpdated: 0,
    });
  });
});
