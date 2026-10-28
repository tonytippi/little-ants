import {
  listeningMedia,
  listeningPayload,
  type ListeningPayload,
  type UnitReleasePayload,
} from '@little-ants/shared';
import { ApiError } from '@little-ants/ui/lib/api-client';
import { api } from './api';
import { getStoredUnit, listStoredUnits, putStoredUnit, type StoredUnit } from './local-db';

/** Cache Storage bucket the service worker serves media from (keep in sync with public/sw.js). */
export const MEDIA_CACHE = 'la-media-v1';

/** Where a unit's leaves come from: a child's unit (parent account) or a class's unit (staff account). */
export type PayloadSource =
  { kind: 'child'; studentId: string; code: string } | { kind: 'school'; code: string };

export interface DownloadProgress {
  done: number;
  total: number;
}

async function fetchPayload(source: PayloadSource): Promise<ListeningPayload> {
  if (source.kind === 'child')
    return api.get<ListeningPayload>(`/parent/students/${source.studentId}/units/${source.code}/listening`);
  const release = await api.get<UnitReleasePayload>(`/teach/units/${source.code}/release`);
  const payload = listeningPayload(release);
  if (!payload) throw new ApiError(404, { message: 'Listening Time is not ready for this unit yet.' });
  return payload;
}

/** True for failures that mean "no connection" rather than an answer from the server. */
export function isOffline(error: unknown): boolean {
  return !(error instanceof ApiError) || error.status === 0;
}

export interface LoadedUnit {
  payload: ListeningPayload;
  /** Shown from the device because the server could not be reached. */
  offline: boolean;
  /** The media is saved on the device. */
  downloaded: boolean;
  /** A newer version than the downloaded one exists (download again to update). */
  outdated: boolean;
}

/**
 * The leaves of a unit: from the server when online (kept on the device for next time), else the copy on the
 * device. A downloaded copy stays as it is until downloaded again, so its media always matches.
 */
export async function loadUnit(source: PayloadSource): Promise<LoadedUnit> {
  const stored = await getStoredUnit(source.code);
  try {
    const payload = await fetchPayload(source);
    if (!stored?.downloaded)
      await putStoredUnit({
        code: payload.unit.code,
        payload,
        savedAt: new Date().toISOString(),
        downloaded: false,
        mediaBytes: 0,
      });
    return {
      payload,
      offline: false,
      downloaded: !!stored?.downloaded,
      outdated: !!stored?.downloaded && stored.payload.version !== payload.version,
    };
  } catch (error) {
    if (stored && isOffline(error))
      return { payload: stored.payload, offline: true, downloaded: stored.downloaded, outdated: false };
    throw error;
  }
}

/** Ask the browser not to evict offline data (most important on iPhone and iPad). */
async function requestPersistentStorage(): Promise<void> {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted()))
      await navigator.storage.persist();
  } catch {
    /* not supported */
  }
}

/** Save a unit's leaves and every picture and recording they use, for listening without internet. */
export async function downloadUnit(
  source: PayloadSource,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<StoredUnit> {
  const payload = await fetchPayload(source);
  const media = listeningMedia(payload);
  const cache = await caches.open(MEDIA_CACHE);
  let done = 0;
  onProgress?.({ done, total: media.length });
  // A few files at a time keeps a weak home connection responsive.
  const queue = [...media];
  const workers = Array.from({ length: 3 }, async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      if (!(await cache.match(item.url))) {
        const response = await fetch(item.url, { mode: 'cors' });
        if (!response.ok) throw new Error(`Could not download ${item.fileName} (${response.status})`);
        await cache.put(item.url, response);
      }
      done += 1;
      onProgress?.({ done, total: media.length });
    }
  });
  await Promise.all(workers);
  await requestPersistentStorage();
  const unit: StoredUnit = {
    code: payload.unit.code,
    payload,
    savedAt: new Date().toISOString(),
    downloaded: true,
    mediaBytes: media.reduce((sum, item) => sum + item.sizeBytes, 0),
  };
  await putStoredUnit(unit);
  await pruneMediaCache();
  return unit;
}

/** Drop cached files no downloaded unit uses any more (e.g. after a unit was updated). */
async function pruneMediaCache(): Promise<void> {
  const keep = new Set<string>();
  for (const unit of await listStoredUnits())
    if (unit.downloaded) for (const item of listeningMedia(unit.payload)) keep.add(item.url);
  const cache = await caches.open(MEDIA_CACHE);
  for (const request of await cache.keys()) if (!keep.has(request.url)) await cache.delete(request);
}
