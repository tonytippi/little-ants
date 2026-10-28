import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ListeningPayload } from '@little-ants/shared';
import type { LocalLog } from './progress';

/** A unit's leaves kept on the device: the last copy seen, and whether its media is downloaded too. */
export interface StoredUnit {
  code: string;
  payload: ListeningPayload;
  savedAt: string;
  /** "Download for offline" finished: every picture and recording is in the media cache. */
  downloaded: boolean;
  mediaBytes: number;
}

/** A leaf played in class (At school), waiting to upload or already uploaded. */
export interface ClassRun {
  clientId: string;
  classId: string;
  unitCode: string;
  leaf: number;
  playedAt: string;
  /** Staff user who played it; only their session uploads it. */
  ownerId: string;
  status: 'pending' | 'synced' | 'rejected';
  reason?: string;
  attempts: number;
  nextAttemptAt: number;
}

interface StudentDb extends DBSchema {
  units: { key: string; value: StoredUnit };
  /** Leaves finished at home on this device (the outbox for /parent/students/:id/listening/sync). */
  logs: { key: string; value: LocalLog };
  /** Leaves played in class (the outbox for /teach/sync). */
  classRuns: { key: string; value: ClassRun };
  /** Small cached API answers (me, summaries) for offline use. */
  kv: { key: string; value: unknown };
}

let dbPromise: Promise<IDBPDatabase<StudentDb>> | null = null;

export function localDb(): Promise<IDBPDatabase<StudentDb>> {
  dbPromise ??= openDB<StudentDb>('little-ants-student', 1, {
    upgrade(db) {
      db.createObjectStore('units', { keyPath: 'code' });
      db.createObjectStore('logs', { keyPath: 'clientId' });
      db.createObjectStore('classRuns', { keyPath: 'clientId' });
      db.createObjectStore('kv');
    },
  });
  return dbPromise;
}

export async function getStoredUnit(code: string): Promise<StoredUnit | undefined> {
  return (await localDb()).get('units', code.toUpperCase());
}

export async function putStoredUnit(unit: StoredUnit): Promise<void> {
  await (await localDb()).put('units', unit);
}

export async function listStoredUnits(): Promise<StoredUnit[]> {
  return (await localDb()).getAll('units');
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  return (await (await localDb()).get('kv', key)) as T | undefined;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  await (await localDb()).put('kv', value, key);
}

/** Forget the signed-in family on this device (cached answers and listening logs). Downloaded units stay. */
export async function clearFamilyData(): Promise<void> {
  const db = await localDb();
  await db.clear('kv');
  await db.clear('logs');
}
