/**
 * Upload rules shared by the apps that queue records offline (Teacher lessons and observations, Student
 * listening logs): back-off, what an HTTP answer means for the queued records, and batching.
 */

const BASE_DELAY_MS = 5_000;
const MAX_DELAY_MS = 10 * 60_000;

/** Wait before the next upload attempt: 5 s, 10 s, 20 s … capped at 10 minutes. */
export function retryDelay(attempts: number): number {
  return Math.min(BASE_DELAY_MS * 2 ** Math.max(0, attempts - 1), MAX_DELAY_MS);
}

export type SyncOutcome = 'sent' | 'retry' | 'wait-for-sign-in' | 'rejected';

/**
 * What to do with queued records after an upload attempt.
 * Network errors and server errors are retried; 401 waits for sign-in;
 * 400/403/404 mean the record can never be accepted, so it is set aside and shown to the user.
 */
export function outcomeFor(status: number | 'network'): SyncOutcome {
  if (status === 'network') return 'retry';
  if (status >= 200 && status < 300) return 'sent';
  if (status === 401) return 'wait-for-sign-in';
  if (status === 400 || status === 403 || status === 404 || status === 422) return 'rejected';
  return 'retry';
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
  batch: { clientId: string }[],
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
