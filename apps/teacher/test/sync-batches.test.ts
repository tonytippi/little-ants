import { describe, expect, it } from 'vitest';
import type { OutboxItem } from '../src/lib/local-db';
import { applySyncResponse, inBatches, ownedBy } from '../src/lib/sync-policy';

function item(clientId: string, ownerId?: string): OutboxItem {
  return {
    clientId,
    kind: 'run',
    record: { clientId, classId: 'c', unitCode: 'U01', lessonNumber: 1, releaseVersion: 1, taughtAt: '', notes: '' },
    attempts: 0,
    nextAttemptAt: 0,
    ownerId,
  } as OutboxItem;
}

describe('inBatches', () => {
  it('splits into batches of the given size', () => {
    expect(inBatches([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(inBatches([], 2)).toEqual([]);
  });
});

describe('applySyncResponse', () => {
  it('removes accepted records, sets rejected ones aside and retries the rest', () => {
    const batch = [item('a'), item('b'), item('c')];
    expect(applySyncResponse(batch, { accepted: ['a'], rejected: [{ clientId: 'b', reason: 'Not your class' }] })).toEqual({
      done: ['a'],
      failed: [{ clientId: 'b', reason: 'Not your class' }],
      retry: ['c'],
    });
  });
});

describe('ownedBy', () => {
  it('keeps records with the teacher who made them', () => {
    expect(ownedBy(item('a', 'u1'), 'u1')).toBe(true);
    expect(ownedBy(item('a', 'u1'), 'u2')).toBe(false);
    expect(ownedBy(item('a'), 'u2')).toBe(true);
  });
});
