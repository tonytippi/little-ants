import { ApiError } from '@little-ants/ui/lib/api-client';
import { api } from './api';
import { kvGet, localDb, type OutboxItem } from './local-db';
import { applySyncResponse, inBatches, isDue, outcomeFor, ownedBy, retryDelay, type SyncResponse } from './sync-policy';
import type { LessonRunRecord, ObservationRecord } from './types';

type Listener = (state: OutboxState) => void;

export interface OutboxState {
  pending: number;
  failed: number;
  syncing: boolean;
  needsSignIn: boolean;
  lastError: string | null;
}

let state: OutboxState = { pending: 0, failed: 0, syncing: false, needsSignIn: false, lastError: null };
const listeners = new Set<Listener>();
let timer: ReturnType<typeof setTimeout> | null = null;

function publish(patch: Partial<OutboxState>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) listener(state);
}

export function subscribeOutbox(listener: Listener): () => void {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

export async function allOutboxItems(): Promise<OutboxItem[]> {
  return (await localDb()).getAll('outbox');
}

/** Id of the signed-in teacher (cached, so it also works offline). */
async function currentUserId(): Promise<string | null> {
  return (await kvGet<{ user: { id: string } } | null>('me'))?.user.id ?? null;
}

/** Records still waiting to be uploaded for the signed-in teacher. */
export async function myOutboxItems(): Promise<OutboxItem[]> {
  const userId = await currentUserId();
  return (await allOutboxItems()).filter((item) => ownedBy(item, userId));
}

/** Remove the signed-in teacher's records from this device (used when signing out). */
export async function removeMyOutboxItems(): Promise<void> {
  const db = await localDb();
  for (const item of await myOutboxItems()) await db.delete('outbox', item.clientId);
}

async function refreshCounts(): Promise<void> {
  const items = await myOutboxItems();
  publish({
    pending: items.filter((item) => !item.failed).length,
    failed: items.filter((item) => item.failed).length,
  });
}

/** Save a lesson run locally and try to upload it. */
export async function queueLessonRun(record: Omit<LessonRunRecord, 'clientId'>): Promise<void> {
  const item: OutboxItem = {
    clientId: crypto.randomUUID(),
    kind: 'run',
    record: { ...record, clientId: '' },
    attempts: 0,
    nextAttemptAt: 0,
    ownerId: (await currentUserId()) ?? undefined,
  };
  item.record.clientId = item.clientId;
  await (await localDb()).put('outbox', item);
  await refreshCounts();
  void flushOutbox();
}

/** Save an observation locally and try to upload it. */
export async function queueObservation(
  record: Omit<ObservationRecord, 'clientId'>,
): Promise<ObservationRecord> {
  const clientId = crypto.randomUUID();
  const full: ObservationRecord = { ...record, clientId };
  await (
    await localDb()
  ).put('outbox', {
    clientId,
    kind: 'observation',
    record: full,
    attempts: 0,
    nextAttemptAt: 0,
    ownerId: (await currentUserId()) ?? undefined,
  });
  await refreshCounts();
  void flushOutbox();
  return full;
}

export async function discardFailed(): Promise<void> {
  const db = await localDb();
  for (const item of await myOutboxItems()) if (item.failed) await db.delete('outbox', item.clientId);
  await refreshCounts();
}

function schedule(delay: number): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void flushOutbox(), delay);
}

/**
 * Upload everything that is due. Safe to call often: the server ignores records it already has.
 * `force` (connection back, or the teacher taps "sync") skips the back-off wait.
 */
export async function flushOutbox(options: { force?: boolean } = {}): Promise<void> {
  if (state.syncing) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    await refreshCounts();
    return;
  }
  const db = await localDb();
  const now = Date.now();
  const mine = await myOutboxItems();
  const due = mine.filter((item) => isDue(item, options.force ? Number.POSITIVE_INFINITY : now));
  if (due.length === 0) {
    await refreshCounts();
    const waiting = mine.filter((item) => !item.failed);
    if (waiting.length) schedule(Math.max(1000, Math.min(...waiting.map((item) => item.nextAttemptAt)) - now));
    return;
  }
  publish({ syncing: true });
  let outcome: ReturnType<typeof outcomeFor> = 'sent';
  let message: string | null = null;
  // Small batches, each answered record by record, so one bad record never holds back the rest.
  for (const batch of inBatches(due)) {
    let status: number | 'network' = 'network';
    let response: SyncResponse | null = null;
    message = null;
    try {
      response = await api.post<SyncResponse>('/teach/sync', {
        lessonRuns: batch.filter((item) => item.kind === 'run').map((item) => item.record),
        observations: batch.filter((item) => item.kind === 'observation').map((item) => item.record),
      });
      status = 200;
    } catch (error) {
      if (error instanceof ApiError) {
        status = error.status === 0 ? 'network' : error.status;
        message = error.message;
      } else {
        message = 'No connection';
      }
    }
    outcome = outcomeFor(status);
    const tx = db.transaction('outbox', 'readwrite');
    if (response) {
      const result = applySyncResponse(batch, response);
      for (const clientId of result.done) await tx.store.delete(clientId);
      for (const { clientId, reason } of result.failed) {
        const item = batch.find((entry) => entry.clientId === clientId)!;
        await tx.store.put({ ...item, failed: reason });
      }
      for (const clientId of result.retry) {
        const item = batch.find((entry) => entry.clientId === clientId)!;
        await tx.store.put({ ...item, attempts: item.attempts + 1, nextAttemptAt: Date.now() + retryDelay(item.attempts + 1) });
      }
    } else {
      for (const item of batch) {
        if (outcome === 'rejected') await tx.store.put({ ...item, failed: message ?? 'Rejected by the server' });
        else await tx.store.put({ ...item, attempts: item.attempts + 1, nextAttemptAt: Date.now() + retryDelay(item.attempts + 1) });
      }
    }
    await tx.done;
    if (outcome === 'retry' || outcome === 'wait-for-sign-in') break;
  }
  publish({
    syncing: false,
    needsSignIn: outcome === 'wait-for-sign-in',
    lastError: outcome === 'sent' ? null : message,
  });
  await refreshCounts();
  if (outcome === 'retry') schedule(retryDelay(due[0]!.attempts + 1));
  else if ((await myOutboxItems()).some((item) => isDue(item, Date.now()))) schedule(1000);
}

let started = false;

/** Start background syncing: now, whenever the connection comes back, and when the tab becomes visible. */
export function startOutbox(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('online', () => void flushOutbox({ force: true }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void flushOutbox();
  });
  void flushOutbox();
}
