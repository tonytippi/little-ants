import { describe, expect, it } from 'vitest';
import { dueItems, expiredLogs, groupBy, settleBatch, type Queued } from '../src/lib/outbox-policy';

type Item = Queued & { studentId: string; playedOn: string };

const item = (clientId: string, overrides: Partial<Item> = {}): Item => ({
  clientId,
  status: 'pending',
  attempts: 0,
  nextAttemptAt: 0,
  studentId: 's1',
  playedOn: '2026-10-28',
  ...overrides,
});

const NOW = 1_000_000;

describe('due records', () => {
  it('sends pending records whose back-off has passed; force ignores the back-off', () => {
    const items = [
      item('a'),
      item('b', { nextAttemptAt: NOW + 5000 }),
      item('c', { status: 'synced' }),
      item('d', { status: 'rejected' }),
    ];
    expect(dueItems(items, NOW).map((entry) => entry.clientId)).toEqual(['a']);
    expect(dueItems(items, NOW, true).map((entry) => entry.clientId)).toEqual(['a', 'b']);
  });

  it('groups home logs per child, keeping their order', () => {
    const groups = groupBy(
      [item('a'), item('b', { studentId: 's2' }), item('c')],
      (entry) => entry.studentId,
    );
    expect([...groups.keys()]).toEqual(['s1', 's2']);
    expect(groups.get('s1')!.map((entry) => entry.clientId)).toEqual(['a', 'c']);
  });
});

describe('after an upload', () => {
  it('marks accepted records synced, keeps refused ones aside and retries the rest', () => {
    const result = settleBatch(
      [item('a'), item('b'), item('c', { attempts: 1 })],
      { accepted: ['a'], rejected: [{ clientId: 'b', reason: 'At most two new leaves a day' }] },
      'sent',
      null,
      NOW,
    );
    expect(result[0]).toMatchObject({ clientId: 'a', status: 'synced' });
    expect(result[1]).toMatchObject({
      clientId: 'b',
      status: 'rejected',
      reason: 'At most two new leaves a day',
    });
    expect(result[2]).toMatchObject({
      clientId: 'c',
      status: 'pending',
      attempts: 2,
      nextAttemptAt: NOW + 10_000,
    });
  });

  it('retries the whole batch with back-off when there is no connection or the server fails', () => {
    for (const outcome of ['retry', 'wait-for-sign-in'] as const) {
      const [result] = settleBatch([item('a')], null, outcome, 'No connection', NOW);
      expect(result).toMatchObject({ status: 'pending', attempts: 1, nextAttemptAt: NOW + 5000 });
    }
  });

  it('sets the whole batch aside when the server refuses the request itself', () => {
    const [result] = settleBatch([item('a')], null, 'rejected', 'Child not found', NOW);
    expect(result).toMatchObject({ status: 'rejected', reason: 'Child not found' });
  });
});

describe('cleaning up', () => {
  it('removes only uploaded logs older than nine weeks', () => {
    const logs = [
      item('old', { status: 'synced', playedOn: '2026-08-01' }),
      item('recent', { status: 'synced', playedOn: '2026-10-01' }),
      item('waiting', { status: 'pending', playedOn: '2026-08-01' }),
    ];
    expect(expiredLogs(logs, '2026-10-28').map((entry) => entry.clientId)).toEqual(['old']);
  });
});
