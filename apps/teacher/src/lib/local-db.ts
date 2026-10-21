import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { UnitReleasePayload } from '@little-ants/shared';
import type { LessonRunRecord, ObservationRecord } from './types';

export type OutboxItem =
  | {
      clientId: string;
      kind: 'run';
      record: LessonRunRecord;
      attempts: number;
      nextAttemptAt: number;
      failed?: string;
      /** Staff user who recorded it; only their session uploads it. */
      ownerId?: string;
    }
  | {
      clientId: string;
      kind: 'observation';
      record: ObservationRecord;
      attempts: number;
      nextAttemptAt: number;
      failed?: string;
      ownerId?: string;
    };

interface StoredRelease {
  code: string;
  payload: UnitReleasePayload;
  downloadedAt: string;
  /** Total bytes of media saved for offline use. */
  mediaBytes: number;
}

interface TeacherDb extends DBSchema {
  releases: { key: string; value: StoredRelease };
  outbox: { key: string; value: OutboxItem };
  /** Small cached API responses (me, classes, units) and per-lesson prep ticks. */
  kv: { key: string; value: unknown };
}

let dbPromise: Promise<IDBPDatabase<TeacherDb>> | null = null;

/** The Teacher app's IndexedDB database (releases, offline outbox, cached responses). */
export function localDb(): Promise<IDBPDatabase<TeacherDb>> {
  dbPromise ??= openDB<TeacherDb>('little-ants-teacher', 1, {
    upgrade(db) {
      db.createObjectStore('releases', { keyPath: 'code' });
      db.createObjectStore('outbox', { keyPath: 'clientId' });
      db.createObjectStore('kv');
    },
  });
  return dbPromise;
}

export async function getStoredRelease(code: string): Promise<StoredRelease | undefined> {
  return (await localDb()).get('releases', code.toUpperCase());
}

export async function putStoredRelease(release: StoredRelease): Promise<void> {
  await (await localDb()).put('releases', release);
}

export async function deleteStoredRelease(code: string): Promise<void> {
  await (await localDb()).delete('releases', code.toUpperCase());
}

export async function listStoredReleases(): Promise<StoredRelease[]> {
  return (await localDb()).getAll('releases');
}

/** Forget everything tied to the signed-in teacher (cached classes, rosters, prep ticks). Downloaded units stay. */
export async function clearPersonalData(): Promise<void> {
  await (await localDb()).clear('kv');
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  return (await (await localDb()).get('kv', key)) as T | undefined;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  await (await localDb()).put('kv', value, key);
}

export type { StoredRelease };
