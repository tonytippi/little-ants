/**
 * What happens to queued records (home listening logs, class runs) after an upload attempt. Pure, so the rules
 * are tested without IndexedDB or a network. The shared rules (back-off, meaning of HTTP answers) live in
 * @little-ants/ui/lib/sync-policy.
 */
import {
  applySyncResponse,
  retryDelay,
  type SyncOutcome,
  type SyncResponse,
} from '@little-ants/ui/lib/sync-policy';
import { addDays } from './progress';

export interface Queued {
  clientId: string;
  status: 'pending' | 'synced' | 'rejected';
  reason?: string;
  attempts: number;
  nextAttemptAt: number;
}

/** Records waiting to upload whose back-off has passed (`force` ignores the back-off). */
export function dueItems<T extends Queued>(items: T[], now: number, force = false): T[] {
  return items.filter((item) => item.status === 'pending' && (force || item.nextAttemptAt <= now));
}

/** Records grouped by a key (home logs upload per child), keeping their order. */
export function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const name = key(item);
    groups.set(name, [...(groups.get(name) ?? []), item]);
  }
  return groups;
}

/**
 * The batch after an upload attempt. With the server's answer: accepted → synced, rejected → set aside with the
 * reason (never sent again), unmentioned → retried later. Without one (network or HTTP error): the whole batch
 * is rejected when the server refused the request itself, otherwise retried with back-off.
 */
export function settleBatch<T extends Queued>(
  batch: T[],
  response: SyncResponse | null,
  outcome: SyncOutcome,
  message: string | null,
  now: number,
): T[] {
  const retry = (item: T): T => ({
    ...item,
    attempts: item.attempts + 1,
    nextAttemptAt: now + retryDelay(item.attempts + 1),
  });
  if (!response) {
    return batch.map((item) =>
      outcome === 'rejected'
        ? { ...item, status: 'rejected', reason: message ?? 'Refused by the server' }
        : retry(item),
    );
  }
  const result = applySyncResponse(batch, response);
  const done = new Set(result.done);
  const failed = new Map(result.failed.map((item) => [item.clientId, item.reason]));
  return batch.map((item) => {
    if (done.has(item.clientId)) return { ...item, status: 'synced', reason: undefined };
    const reason = failed.get(item.clientId);
    if (reason !== undefined) return { ...item, status: 'rejected', reason };
    return retry(item);
  });
}

/** Uploaded logs are kept this long for the weekly view on the device, then removed. */
export const KEEP_SYNCED_DAYS = 63;

/** Uploaded logs older than the weeks the app shows: safe to delete (the server has them). */
export function expiredLogs<T extends Queued & { playedOn: string }>(logs: T[], today: string): T[] {
  const oldest = addDays(today, -KEEP_SYNCED_DAYS);
  return logs.filter((log) => log.status === 'synced' && log.playedOn < oldest);
}
