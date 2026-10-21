import { releaseMedia, type UnitReleasePayload } from '@little-ants/shared';
import { api } from './api';
import { deleteStoredRelease, getStoredRelease, listStoredReleases, putStoredRelease } from './local-db';

/** Cache Storage bucket the service worker serves media from (keep in sync with public/sw.js). */
export const MEDIA_CACHE = 'la-media-v1';

export interface DownloadProgress {
  done: number;
  total: number;
  bytes: number;
  totalBytes: number;
}

/** Ask the browser not to evict offline data (most important on iPad). */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}

/** Fetch the latest release of a unit and save it, with every media file, for offline teaching. */
export async function downloadUnit(
  code: string,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<UnitReleasePayload> {
  const payload = await api.get<UnitReleasePayload>(`/teach/units/${code}/release`);
  const media = releaseMedia(payload);
  const totalBytes = media.reduce((sum, item) => sum + item.sizeBytes, 0);
  const cache = await caches.open(MEDIA_CACHE);
  let done = 0;
  let bytes = 0;
  onProgress?.({ done, total: media.length, bytes, totalBytes });
  // A few files at a time keeps weak school Wi-Fi responsive.
  const queue = [...media];
  const workers = Array.from({ length: 3 }, async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      if (!(await cache.match(item.url))) {
        const response = await fetch(item.url, { mode: 'cors' });
        if (!response.ok) throw new Error(`Could not download ${item.fileName} (${response.status})`);
        await cache.put(item.url, response);
      }
      done += 1;
      bytes += item.sizeBytes;
      onProgress?.({ done, total: media.length, bytes, totalBytes });
    }
  });
  await Promise.all(workers);
  await requestPersistentStorage();
  await putStoredRelease({
    code: payload.unit.code,
    payload,
    downloadedAt: new Date().toISOString(),
    mediaBytes: totalBytes,
  });
  await pruneMediaCache();
  return payload;
}

/** Remove a downloaded unit and any media no other downloaded unit uses. */
export async function removeUnit(code: string): Promise<void> {
  await deleteStoredRelease(code);
  await pruneMediaCache();
}

async function pruneMediaCache(): Promise<void> {
  const keep = new Set<string>();
  for (const release of await listStoredReleases())
    for (const item of releaseMedia(release.payload)) keep.add(item.url);
  const cache = await caches.open(MEDIA_CACHE);
  for (const request of await cache.keys()) if (!keep.has(request.url)) await cache.delete(request);
}

/** The release to teach from: the downloaded copy, or (when online and not downloaded) the latest from the server. */
export async function loadRelease(code: string): Promise<{ payload: UnitReleasePayload; offline: boolean }> {
  const stored = await getStoredRelease(code);
  if (stored) return { payload: stored.payload, offline: true };
  return { payload: await api.get<UnitReleasePayload>(`/teach/units/${code}/release`), offline: false };
}
