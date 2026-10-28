import type { ServerObservation } from './types';
import type { OutboxItem } from './local-db';

export {
  SYNC_BATCH_SIZE,
  applySyncResponse,
  inBatches,
  outcomeFor,
  retryDelay,
  type SyncOutcome,
  type SyncResponse,
} from '@little-ants/ui/lib/sync-policy';

export function isDue(item: OutboxItem, now: number): boolean {
  return !item.failed && item.nextAttemptAt <= now;
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

/** Records belong to the teacher who made them; items saved before owners were recorded count as anyone's. */
export function ownedBy(item: OutboxItem, userId: string | null): boolean {
  return !item.ownerId || item.ownerId === userId;
}
