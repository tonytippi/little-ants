/**
 * Offline-first uploads. Finished leaves are saved in IndexedDB first, then sent when there is a connection:
 * home logs to /parent/students/:id/listening/sync (per child), class runs to /teach/sync. The server answers per
 * record; refused records are kept aside (they never count again), others are retried with back-off.
 */
import { ApiError } from '@little-ants/ui/lib/api-client';
import {
  inBatches,
  outcomeFor,
  retryDelay,
  type SyncOutcome,
  type SyncResponse,
} from '@little-ants/ui/lib/sync-policy';
import { api } from './api';
import { kvGet, localDb, type ClassRun } from './local-db';
import { dueItems, expiredLogs, groupBy, settleBatch } from './outbox-policy';
import { localDay, type LocalLog } from './progress';
import type { ParentMe, StaffMe } from './types';

export interface OutboxState {
  pending: number;
  rejected: number;
  syncing: boolean;
  /** Bumped after every change, so screens re-read local logs. */
  version: number;
}

type Listener = (state: OutboxState) => void;
let state: OutboxState = { pending: 0, rejected: 0, syncing: false, version: 0 };
const listeners = new Set<Listener>();
let timer: ReturnType<typeof setTimeout> | null = null;

function publish(patch: Partial<OutboxState>): void {
  state = { ...state, ...patch, version: state.version + 1 };
  for (const listener of listeners) listener(state);
}

export function subscribeOutbox(listener: Listener): () => void {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

export function outboxState(): OutboxState {
  return state;
}

export async function allLogs(): Promise<LocalLog[]> {
  return (await localDb()).getAll('logs');
}

export async function allClassRuns(): Promise<ClassRun[]> {
  return (await localDb()).getAll('classRuns');
}

async function refreshCounts(): Promise<void> {
  const items = [...(await allLogs()), ...(await allClassRuns())];
  publish({
    pending: items.filter((item) => item.status === 'pending').length,
    rejected: items.filter((item) => item.status === 'rejected').length,
  });
}

/** Save a leaf finished at home and try to upload it. */
export async function queueLog(
  log: Omit<LocalLog, 'clientId' | 'status' | 'attempts' | 'nextAttemptAt'>,
): Promise<LocalLog> {
  const record: LocalLog = {
    ...log,
    clientId: crypto.randomUUID(),
    status: 'pending',
    attempts: 0,
    nextAttemptAt: 0,
  };
  await (await localDb()).put('logs', record);
  await refreshCounts();
  void flushOutbox();
  return record;
}

/** Save a leaf played in class and try to upload it. */
export async function queueClassRun(
  run: Omit<ClassRun, 'clientId' | 'status' | 'attempts' | 'nextAttemptAt'>,
): Promise<ClassRun> {
  const record: ClassRun = {
    ...run,
    clientId: crypto.randomUUID(),
    status: 'pending',
    attempts: 0,
    nextAttemptAt: 0,
  };
  await (await localDb()).put('classRuns', record);
  await refreshCounts();
  void flushOutbox();
  return record;
}

/** POST a batch; the outcome and the server's per-record answer (when it answered). */
async function send(
  path: string,
  body: unknown,
): Promise<{ outcome: SyncOutcome; response: SyncResponse | null; message: string | null }> {
  try {
    const response = await api.post<SyncResponse>(path, body);
    return { outcome: 'sent', response, message: null };
  } catch (error) {
    if (error instanceof ApiError)
      return { outcome: outcomeFor(error.status), response: null, message: error.message };
    return { outcome: 'retry', response: null, message: 'No connection' };
  }
}

/** Upload due home logs of the signed-in parent's children. Returns false when uploading should stop for now. */
async function flushLogs(force: boolean): Promise<boolean> {
  const me = await kvGet<ParentMe>('parent-me');
  if (!me) return true;
  const children = new Set(me.children.map((child) => child.id));
  const due = dueItems(await allLogs(), Date.now(), force).filter((log) => children.has(log.studentId));
  for (const [studentId, logs] of groupBy(due, (log) => log.studentId)) {
    for (const batch of inBatches(logs)) {
      // The shape of listeningSyncInput (dates as strings: the server parses them).
      const body = {
        logs: batch.map((log) => ({
          clientId: log.clientId,
          unitCode: log.unitCode,
          leaf: log.leaf,
          playedOn: log.playedOn,
          completedAt: log.completedAt,
          itemsHeard: log.itemsHeard,
        })),
      };
      const { outcome, response, message } = await send(`/parent/students/${studentId}/listening/sync`, body);
      const tx = (await localDb()).transaction('logs', 'readwrite');
      for (const item of settleBatch(batch, response, outcome, message, Date.now())) await tx.store.put(item);
      await tx.done;
      if (outcome === 'retry' || outcome === 'wait-for-sign-in') return false;
    }
  }
  return true;
}

/** Upload due class runs played by the signed-in staff user. */
async function flushClassRuns(force: boolean): Promise<boolean> {
  const staff = await kvGet<StaffMe>('staff-me');
  if (!staff) return true;
  const due = dueItems(await allClassRuns(), Date.now(), force).filter(
    (run) => run.ownerId === staff.user.id,
  );
  for (const batch of inBatches(due)) {
    const { outcome, response, message } = await send('/teach/sync', {
      listeningRuns: batch.map(({ clientId, classId, unitCode, leaf, playedAt }) => ({
        clientId,
        classId,
        unitCode,
        leaf,
        playedAt,
      })),
    });
    const tx = (await localDb()).transaction('classRuns', 'readwrite');
    for (const item of settleBatch(batch, response, outcome, message, Date.now())) await tx.store.put(item);
    await tx.done;
    if (outcome === 'retry' || outcome === 'wait-for-sign-in') return false;
  }
  return true;
}

function schedule(delay: number): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void flushOutbox(), delay);
}

/** Remove uploaded logs older than the weeks the app shows (the server keeps them). */
async function pruneLogs(): Promise<void> {
  const db = await localDb();
  for (const log of expiredLogs(await allLogs(), localDay())) await db.delete('logs', log.clientId);
}

/**
 * Upload everything that is due. Safe to call often: the server ignores records it already has.
 * `force` (connection back) skips the back-off wait.
 */
export async function flushOutbox(options: { force?: boolean } = {}): Promise<void> {
  if (state.syncing) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    await refreshCounts();
    return;
  }
  publish({ syncing: true });
  let completed: boolean;
  try {
    completed = (await flushLogs(!!options.force)) && (await flushClassRuns(!!options.force));
    await pruneLogs();
  } catch {
    completed = false; // IndexedDB or unexpected failure: try again later
  } finally {
    publish({ syncing: false });
    await refreshCounts();
  }
  const waiting = [...(await allLogs()), ...(await allClassRuns())].filter(
    (item) => item.status === 'pending',
  );
  if (!waiting.length) return;
  const next = Math.min(...waiting.map((item) => item.nextAttemptAt));
  schedule(completed ? Math.max(1000, next - Date.now()) : Math.max(retryDelay(1), next - Date.now()));
}

/** Records refused by the server are only kept to explain them; the parent can clear them. */
export async function discardRejected(): Promise<void> {
  const db = await localDb();
  for (const log of await allLogs()) if (log.status === 'rejected') await db.delete('logs', log.clientId);
  for (const run of await allClassRuns())
    if (run.status === 'rejected') await db.delete('classRuns', run.clientId);
  await refreshCounts();
}

let started = false;

/** Start background uploads: now, whenever the connection comes back, and when the app becomes visible. */
export function startOutbox(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('online', () => void flushOutbox({ force: true }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void flushOutbox();
  });
  void flushOutbox();
}
