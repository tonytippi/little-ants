import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { AssetKind, PrismaClient } from '@little-ants/db';
import { assetStorageKey, type ObjectStorage } from '@little-ants/storage';

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

/** Draft layout PDFs are named like "U01_ST1_Who-Is-This_DRAFT.pdf"; the second part is the material code. */
export function materialCodeFromDesignFile(file: string): string | null {
  const parts = path.basename(file).split('_');
  return parts.length > 2 ? (parts[1] ?? null) : null;
}

const POSTER_TYPES = new Set(['SONG', 'CHANT', 'RHYME', 'ROUTINE']);

/**
 * Materials a draft file belongs to: one material ("U01_ST1_…"), every material of a family
 * ("U01_MD_Move-and-Do-Cards" → MD1, MD2, MD3) or every poster ("U01_POSTERS_…" → songs, chants, rhymes, routines).
 */
export function materialsForDesignFile<T extends { code: string; type: string }>(file: string, materials: T[]): T[] {
  const code = materialCodeFromDesignFile(file);
  if (!code) return [];
  if (code.toUpperCase() === 'POSTERS') return materials.filter((material) => POSTER_TYPES.has(material.type));
  const exact = materials.filter((material) => material.code === code);
  if (exact.length > 0) return exact;
  if (/^[A-Z]{2}$/.test(code)) return materials.filter((material) => new RegExp(`^${code}\\d+$`).test(material.code));
  return [];
}

export async function importDraftDesigns(
  prisma: PrismaClient,
  storage: ObjectStorage,
  unitId: string,
  files: string[],
): Promise<{ linked: number; unmatched: string[] }> {
  const materials = await prisma.material.findMany({ where: { unitId }, select: { id: true, code: true, type: true } });
  const unmatched: string[] = [];
  let linked = 0;
  for (const file of files) {
    const targets = materialsForDesignFile(file, materials);
    if (targets.length === 0) {
      unmatched.push(path.basename(file));
      continue;
    }
    const asset = await importFileAsAsset(prisma, storage, file);
    for (const material of targets) {
      await prisma.materialAsset.upsert({
        where: { materialId_assetId_role: { materialId: material.id, assetId: asset.id, role: 'draft-layout' } },
        update: {},
        create: { materialId: material.id, assetId: asset.id, role: 'draft-layout' },
      });
    }
    linked += 1;
  }
  return { linked, unmatched };
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
