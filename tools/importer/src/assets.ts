import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { AssetKind, PrismaClient } from '@little-ants/db';
import { assetStorageKey, type ObjectStorage } from '@little-ants/storage';
import { IMPORTED_ROLES, type MediaPlan } from './media-plan.js';

const MIME_TYPES: Record<string, { mime: string; kind: AssetKind }> = {
  '.pdf': { mime: 'application/pdf', kind: 'PDF' },
  '.png': { mime: 'image/png', kind: 'IMAGE' },
  '.jpg': { mime: 'image/jpeg', kind: 'IMAGE' },
  '.jpeg': { mime: 'image/jpeg', kind: 'IMAGE' },
  '.mp3': { mime: 'audio/mpeg', kind: 'AUDIO' },
};

export interface UploadedAsset {
  id: string;
  created: boolean;
}

/**
 * Upload a local file as a draft asset. Files already imported (same checksum) are reused,
 * so running the import again does not create duplicates.
 */
export async function importFileAsAsset(
  prisma: PrismaClient,
  storage: ObjectStorage,
  file: string,
  displayName = path.basename(file),
): Promise<UploadedAsset> {
  const type = MIME_TYPES[path.extname(file).toLowerCase()];
  if (!type) throw new Error(`Unsupported file type: ${file}`);
  const body = await readFile(file);
  const checksum = createHash('sha256').update(body).digest('hex');
  const existing = await prisma.asset.findFirst({ where: { checksum, source: 'import' } });
  if (existing?.uploaded) return { id: existing.id, created: false };
  if (existing) {
    // An earlier run created the row but the upload failed: try the upload again.
    await storage.put(existing.storageKey, body, existing.mimeType);
    await prisma.asset.update({ where: { id: existing.id }, data: { uploaded: true } });
    return { id: existing.id, created: false };
  }

  const fileName = displayName.replace(/\s*\(\d+\)(?=\.[^.]+$)/, ''); // "file (1).pdf" → "file.pdf"
  const asset = await prisma.asset.create({
    data: {
      kind: type.kind,
      storageKey: `pending/${checksum}`,
      fileName,
      mimeType: type.mime,
      sizeBytes: body.length,
      checksum,
      source: 'import',
      uploaded: false,
    },
  });
  const storageKey = assetStorageKey(asset.id, 1, fileName);
  await prisma.asset.update({ where: { id: asset.id }, data: { storageKey } });
  await storage.put(storageKey, body, type.mime);
  await prisma.asset.update({ where: { id: asset.id }, data: { uploaded: true } });
  return { id: asset.id, created: true };
}

export interface UnitMediaResult {
  /** Files linked, by role (word pictures under "word"). */
  linked: Record<string, number>;
  /** Earlier importer links no longer backed by a source file. */
  removed: number;
}

/**
 * Apply a media plan to a unit. The source folder is the truth for the importer's own files: links and word
 * pictures the importer made before that are no longer in the plan (removed or replaced on the source) are undone.
 * Files people attached in Admin are never touched.
 */
export async function importUnitMedia(prisma: PrismaClient, storage: ObjectStorage, unitId: string, plan: MediaPlan): Promise<UnitMediaResult> {
  const materials = await prisma.material.findMany({ where: { unitId }, select: { id: true, code: true } });
  const materialIds = new Map(materials.map((material) => [material.code, material.id]));
  // Counted per file: one poster PDF linked to six materials is one file.
  const files = new Map<string, Set<string>>();
  const count = (key: string, file: string): void => {
    files.set(key, (files.get(key) ?? new Set()).add(file));
  };

  const keep = new Map<string, Set<string>>(); // `${materialId}:${role}` → asset ids
  for (const link of plan.links) {
    const materialId = materialIds.get(link.materialCode);
    if (!materialId) continue;
    const asset = await importFileAsAsset(prisma, storage, link.file);
    await prisma.materialAsset.upsert({
      where: { materialId_assetId_role: { materialId, assetId: asset.id, role: link.role } },
      update: { order: link.order },
      create: { materialId, assetId: asset.id, role: link.role, order: link.order },
    });
    const key = `${materialId}:${link.role}`;
    keep.set(key, (keep.get(key) ?? new Set()).add(asset.id));
    count(link.role, link.file);
  }
  let removed = 0;
  for (const material of materials) {
    for (const role of IMPORTED_ROLES) {
      const result = await prisma.materialAsset.deleteMany({
        where: { materialId: material.id, role, asset: { source: 'import' }, assetId: { notIn: [...(keep.get(`${material.id}:${role}`) ?? [])] } },
      });
      removed += result.count;
    }
  }

  const keepPictures = new Map<string, Set<string>>(); // role → asset ids
  for (const picture of plan.pictures) {
    const asset = await importFileAsAsset(prisma, storage, picture.file);
    await prisma.unitAsset.upsert({
      where: { unitId_assetId_role: { unitId, assetId: asset.id, role: picture.role } },
      update: { label: picture.label, order: picture.order },
      create: { unitId, assetId: asset.id, role: picture.role, label: picture.label, order: picture.order },
    });
    keepPictures.set(picture.role, (keepPictures.get(picture.role) ?? new Set()).add(asset.id));
    count(picture.role, picture.file);
  }
  for (const role of ['cover', 'place']) {
    const result = await prisma.unitAsset.deleteMany({
      where: { unitId, role, asset: { source: 'import' }, assetId: { notIn: [...(keepPictures.get(role) ?? [])] } },
    });
    removed += result.count;
  }

  const pictured = new Set<string>();
  for (const image of plan.words) {
    const asset = await importFileAsAsset(prisma, storage, image.file);
    await prisma.word.updateMany({ where: { unitId, cardId: image.cardId }, data: { imageAssetId: asset.id } });
    pictured.add(image.cardId);
    count('word', image.file);
  }
  const cleared = await prisma.word.updateMany({
    where: { unitId, cardId: { notIn: [...pictured] }, imageAsset: { source: 'import' } },
    data: { imageAssetId: null },
  });
  const linked = Object.fromEntries([...files].map(([key, set]) => [key, set.size]));
  return { linked, removed: removed + cleared.count };
}

/** Character art files are named CHAR_01_Annie.png → character code CHAR_01. */
export async function importCharacterArt(
  prisma: PrismaClient,
  storage: ObjectStorage,
  files: string[],
): Promise<number> {
  let linked = 0;
  for (const file of files) {
    const code = /^(CHAR_\d+b?)_/.exec(path.basename(file))?.[1];
    if (!code) continue;
    const character = await prisma.character.findUnique({ where: { code } });
    if (!character) continue;
    const asset = await importFileAsAsset(prisma, storage, file);
    await prisma.character.update({ where: { id: character.id }, data: { artAssetId: asset.id } });
    linked += 1;
  }
  return linked;
}
