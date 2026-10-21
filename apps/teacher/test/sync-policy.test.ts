import { describe, expect, it } from 'vitest';
import type { OutboxItem } from '../src/lib/local-db';
import { isDue, mergeObservations, nextLevel, outcomeFor, retryDelay } from '../src/lib/sync-policy';

const observation = (
  clientId: string,
  overrides: Partial<Extract<OutboxItem, { kind: 'observation' }>['record']> = {},
  extra: Partial<OutboxItem> = {},
): OutboxItem =>
  ({
    clientId,
    kind: 'observation',
    attempts: 0,
    nextAttemptAt: 0,
    record: {
      clientId,
      studentId: 's1',
      classId: 'c1',
      unitCode: 'U01',
      goalOrder: 1,
      level: 'WITH_HELP',
      lessonNumber: 12,
      observedAt: '2026-10-21T08:00:00.000Z',
      ...overrides,
    },
    ...extra,
  }) as OutboxItem;

describe('retry policy', () => {
  it('backs off exponentially and caps at ten minutes', () => {
    expect(retryDelay(1)).toBe(5_000);
    expect(retryDelay(2)).toBe(10_000);
    expect(retryDelay(4)).toBe(40_000);
    expect(retryDelay(20)).toBe(600_000);
  });

  it('only sends items that are due and not refused', () => {
    expect(isDue(observation('a'), 1)).toBe(true);
    expect(isDue(observation('a', {}, { nextAttemptAt: 10 }), 5)).toBe(false);
    expect(isDue(observation('a', {}, { failed: 'Not your class' }), 5)).toBe(false);
  });

  it('decides what to do with each server answer', () => {
    expect(outcomeFor(201)).toBe('sent');
    expect(outcomeFor('network')).toBe('retry');
    expect(outcomeFor(503)).toBe('retry');
    expect(outcomeFor(401)).toBe('wait-for-sign-in');
    expect(outcomeFor(403)).toBe('rejected');
    expect(outcomeFor(400)).toBe('rejected');
  });
});

describe('mergeObservations', () => {
  const server = [
    {
      studentId: 's1',
      goalOrder: 1,
      level: 'NOT_YET' as const,
      observedAt: '2026-10-20T08:00:00.000Z',
      lessonNumber: 12,
    },
    {
      studentId: 's2',
      goalOrder: 1,
      level: 'ON_MY_OWN' as const,
      observedAt: '2026-10-22T08:00:00.000Z',
      lessonNumber: 26,
    },
  ];

  it('shows a newer tap that is still waiting to sync', () => {
    const merged = mergeObservations(server, [observation('a')], 'c1', 'U01');
    expect(merged.get('s1:1')).toEqual({
      level: 'WITH_HELP',
      observedAt: '2026-10-21T08:00:00.000Z',
      pending: true,
    });
  });

  it('keeps the newer server result over an older local one', () => {
    const merged = mergeObservations(server, [observation('b', { studentId: 's2' })], 'c1', 'U01');
    expect(merged.get('s2:1')).toMatchObject({ level: 'ON_MY_OWN', pending: false });
  });

  it('ignores other classes, other units and refused records', () => {
    const merged = mergeObservations(
      [],
      [
        observation('c', { classId: 'c2' }),
        observation('d', { unitCode: 'U02' }),
        observation('e', {}, { failed: 'no' }),
      ],
      'c1',
      'U01',
    );
    expect(merged.size).toBe(0);
  });
});

describe('nextLevel', () => {
  it('cycles Not yet → With help → On my own → Not yet', () => {
    expect(nextLevel(null)).toBe('NOT_YET');
    expect(nextLevel('NOT_YET')).toBe('WITH_HELP');
    expect(nextLevel('WITH_HELP')).toBe('ON_MY_OWN');
    expect(nextLevel('ON_MY_OWN')).toBe('NOT_YET');
  });
});
