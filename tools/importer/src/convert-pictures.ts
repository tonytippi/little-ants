import type { Prisma, PrismaClient } from '@little-ants/db';
import {
  S3Storage,
  WEB_IMAGE_MIME_TYPE,
  assetStorageKey,
  toWebImage,
  type ObjectStorage,
} from '@little-ants/storage';

const OLD_PICTURE_TYPES = ['image/png', 'image/jpeg'];
const OLD_PICTURE_KEY = /\.(png|jpe?g)$/i;

export interface ConvertPicturesResult {
  /** PNG and JPEG pictures found. */
  pictures: number;
  converted: number;
  bytesBefore: number;
  bytesAfter: number;
  /** Not on the server nor in the public bucket: left as they are. */
  missing: string[];
  /** Could not be decoded: left as they are. */
  unreadable: string[];
  /** Reading or uploading failed even after retries: left as they are, so a later run picks them up. */
  failed: string[];
  releasesUpdated: number;
  /** PNG and JPEG files removed from the public bucket. */
  publicFilesDeleted: number;
}

/**
 * Turn the PNG and JPEG pictures stored before pictures became WebP into WebP, point published releases at the
 * new files and remove the old pictures from the server and the public bucket. Safe to run again: converted rows
 * are skipped, and old public files are removed only once no asset row refers to them.
 * Without `apply` it only counts what it would do.
 */
export async function convertPicturesToWebp(
  prisma: PrismaClient,
  storage: ObjectStorage,
  options: { apply: boolean; log?: (message: string) => void },
): Promise<ConvertPicturesResult> {
  const log = options.log ?? (() => {});
  const assets = await prisma.asset.findMany({
    where: { kind: 'IMAGE', mimeType: { in: OLD_PICTURE_TYPES } },
    select: { id: true, version: true, storageKey: true, fileName: true, status: true, sizeBytes: true },
    orderBy: { createdAt: 'asc' },
  });
  const result: ConvertPicturesResult = {
    pictures: assets.length,
    converted: 0,
    bytesBefore: 0,
    bytesAfter: 0,
    missing: [],
    unreadable: [],
    failed: [],
    releasesUpdated: 0,
    publicFilesDeleted: 0,
  };
  if (!options.apply) {
    result.bytesBefore = assets.reduce((sum, asset) => sum + asset.sizeBytes, 0);
    return result;
  }

  const readPicture = async (asset: (typeof assets)[number]): Promise<Buffer | null> =>
    (await storage.get(asset.storageKey)) ??
    (storage instanceof S3Storage && asset.status === 'APPROVED'
      ? await storage.getPublic(asset.storageKey)
      : null);

  for (const [index, asset] of assets.entries()) {
    if (index > 0 && index % 50 === 0) log(`Checked ${index} of ${assets.length} pictures`);
    let body: Buffer | null;
    try {
      body = await withRetries(() => readPicture(asset));
    } catch (error) {
      result.failed.push(`${asset.storageKey}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    if (!body) {
      result.missing.push(asset.storageKey);
      continue;
    }
    const image = await toWebImage(body, asset.fileName).catch(() => null);
    if (!image) {
      result.unreadable.push(asset.storageKey);
      continue;
    }
    const storageKey = assetStorageKey(asset.id, asset.version, image.fileName);
    try {
      await storage.put(storageKey, image.body, image.mimeType);
      if (asset.status === 'APPROVED') await withRetries(() => storage.publish(storageKey, image.mimeType));
    } catch (error) {
      result.failed.push(`${asset.storageKey}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    await prisma.asset.update({
      where: { id: asset.id },
      data: { storageKey, fileName: image.fileName, mimeType: image.mimeType, sizeBytes: image.body.length },
    });
    await storage.delete(asset.storageKey);
    result.converted += 1;
    result.bytesBefore += body.length;
    result.bytesAfter += image.body.length;
  }

  result.releasesUpdated = await pointReleasesAtWebp(prisma, storage);
  log(`Updated ${result.releasesUpdated} published releases`);

  if (storage instanceof S3Storage) {
    const referenced = new Set(
      (await prisma.asset.findMany({ select: { storageKey: true } })).map((asset) => asset.storageKey),
    );
    const stale = (await storage.listPublic('assets/')).filter(
      (key) => OLD_PICTURE_KEY.test(key) && !referenced.has(key),
    );
    await storage.deletePublic(stale);
    result.publicFilesDeleted = stale.length;
    log(`Deleted ${stale.length} old pictures from the public bucket`);
  }
  return result;
}

/** Network reads and uploads to the bucket sometimes drop; try a few times before giving up on a picture. */
async function withRetries<T>(run: () => Promise<T>, attempts = 3): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      if (attempt >= attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
}

interface MediaEntry {
  id: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  fileName: string;
}

function isMediaEntry(value: unknown): value is MediaEntry {
  const entry = value as Partial<MediaEntry> | null;
  return (
    typeof entry === 'object' &&
    entry !== null &&
    typeof entry.id === 'string' &&
    typeof entry.url === 'string' &&
    typeof entry.mimeType === 'string'
  );
}

/**
 * Releases keep the URL, type and size of every file, so they would still point at the old pictures. The picture
 * is the same one in a lighter format, so the media entries are updated in place instead of publishing new
 * versions. Returns how many releases changed.
 */
async function pointReleasesAtWebp(prisma: PrismaClient, storage: ObjectStorage): Promise<number> {
  const pictures = new Map(
    (
      await prisma.asset.findMany({
        where: { kind: 'IMAGE', mimeType: WEB_IMAGE_MIME_TYPE, status: 'APPROVED' },
        select: { id: true, storageKey: true, fileName: true, mimeType: true, sizeBytes: true },
      })
    ).map((asset) => [asset.id, asset]),
  );
  const releases = await prisma.unitRelease.findMany({ select: { id: true, payload: true } });
  let updated = 0;
  for (const release of releases) {
    let changed = false;
    const visit = (value: unknown): void => {
      if (Array.isArray(value)) return value.forEach(visit);
      if (typeof value !== 'object' || value === null) return;
      const picture = isMediaEntry(value) ? pictures.get(value.id) : undefined;
      if (picture && isMediaEntry(value) && value.mimeType !== picture.mimeType) {
        value.url = storage.publicUrl(picture.storageKey);
        value.mimeType = picture.mimeType;
        value.sizeBytes = picture.sizeBytes;
        value.fileName = picture.fileName;
        changed = true;
      }
      Object.values(value).forEach(visit);
    };
    visit(release.payload);
    if (!changed) continue;
    await prisma.unitRelease.update({
      where: { id: release.id },
      data: { payload: release.payload as Prisma.InputJsonValue },
    });
    updated += 1;
  }
  return updated;
}
