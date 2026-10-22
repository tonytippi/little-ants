import type { ServerObservation } from './types';
import type { OutboxItem } from './local-db';

const BASE_DELAY_MS = 5_000;
const MAX_DELAY_MS = 10 * 60_000;

/** Wait before the next upload attempt: 5 s, 10 s, 20 s … capped at 10 minutes. */
export function retryDelay(attempts: number): number {
  return Math.min(BASE_DELAY_MS * 2 ** Math.max(0, attempts - 1), MAX_DELAY_MS);
}

export function isDue(item: OutboxItem, now: number): boolean {
  return !item.failed && item.nextAttemptAt <= now;
}

export type SyncOutcome = 'sent' | 'retry' | 'wait-for-sign-in' | 'rejected';

/**
 * What to do with queued records after an upload attempt.
 * Network errors and server errors are retried; 401 waits for sign-in;
 * 400/403/404 mean the record can never be accepted, so it is set aside and shown to the teacher.
 */
export function outcomeFor(status: number | 'network'): SyncOutcome {
  if (status === 'network') return 'retry';
  if (status >= 200 && status < 300) return 'sent';
  if (status === 401) return 'wait-for-sign-in';
  if (status === 400 || status === 403 || status === 404 || status === 422) return 'rejected';
  return 'retry';
}

export interface MergedResult {
  level: ServerObservation['level'];
  observedAt: string;
  pending: boolean;
}

/**
 * Latest result per child and goal: the newest of the server results and the records
 * still waiting in the outbox (so a teacher sees their own taps straight away, even offline).
 */
export function mergeObservations(
  server: ServerObservation[],
  pending: OutboxItem[],
  classId: string,
  unitCode: string,
): Map<string, MergedResult> {
  const merged = new Map<string, MergedResult>();
  const offer = (key: string, value: MergedResult): void => {
    const current = merged.get(key);
    if (!current || current.observedAt < value.observedAt) merged.set(key, value);
  };
  for (const row of server) {
    offer(observationKey(row.studentId, row.goalOrder), {
      level: row.level,
      observedAt: row.observedAt,
      pending: false,
    });
  }
  for (const item of pending) {
    if (item.kind !== 'observation' || item.failed) continue;
    const record = item.record;
    if (record.classId !== classId || record.unitCode !== unitCode) continue;
    offer(observationKey(record.studentId, record.goalOrder), {
      level: record.level,
      observedAt: record.observedAt,
      pending: true,
    });
  }
  return merged;
}

export function observationKey(studentId: string, goalOrder: number): string {
  return `${studentId}:${goalOrder}`;
}

const CYCLE: (ServerObservation['level'] | null)[] = [null, 'NOT_YET', 'WITH_HELP', 'ON_MY_OWN'];

/** Next level when the teacher taps a cell: empty → Not yet → With help → On my own → Not yet … */
export function nextLevel(
  current: ServerObservation['level'] | null | undefined,
): ServerObservation['level'] {
  const index = CYCLE.indexOf(current ?? null);
  const next = CYCLE[(index + 1) % CYCLE.length] ?? 'NOT_YET';
  return next ?? 'NOT_YET';
}

/** Records per upload request (well under the server limits). */
export const SYNC_BATCH_SIZE = 150;

export function inBatches<T>(items: T[], size = SYNC_BATCH_SIZE): T[][] {
  const batches: T[][] = [];
  for (let start = 0; start < items.length; start += size) batches.push(items.slice(start, start + size));
  return batches;
}

export interface SyncResponse {
  accepted: string[];
  rejected: { clientId: string; reason: string }[];
}

/**
 * Split a batch by the server's per-record answer: accepted records leave the outbox,
 * rejected ones are set aside with the reason, anything the server did not mention is retried.
 */
export function applySyncResponse(
  batch: OutboxItem[],
  response: SyncResponse,
): { done: string[]; failed: { clientId: string; reason: string }[]; retry: string[] } {
  const accepted = new Set(response.accepted);
  const rejected = new Map(response.rejected.map((item) => [item.clientId, item.reason]));
  const done: string[] = [];
  const failed: { clientId: string; reason: string }[] = [];
  const retry: string[] = [];
  for (const item of batch) {
    if (accepted.has(item.clientId)) done.push(item.clientId);
    else if (rejected.has(item.clientId))
      failed.push({ clientId: item.clientId, reason: rejected.get(item.clientId)! });
    else retry.push(item.clientId);
  }
  return { done, failed, retry };
}

/** Records belong to the teacher who made them; items saved before owners were recorded count as anyone's. */
export function ownedBy(item: OutboxItem, userId: string | null): boolean {
  return !item.ownerId || item.ownerId === userId;
}
