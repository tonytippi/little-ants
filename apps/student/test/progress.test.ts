import { describe, expect, it } from 'vitest';
import {
  addDays,
  canStartLeaf,
  classProgress,
  leafState,
  leafWeeks,
  localDay,
  localListeningDays,
  mergeHeard,
  mergeProgress,
  recentWeeks,
  weekDates,
  type LocalLog,
} from '../src/lib/progress';

const TODAY = '2026-10-28'; // a Wednesday

let counter = 0;
const log = (overrides: Partial<LocalLog> = {}): LocalLog => ({
  clientId: `c${(counter += 1)}`,
  studentId: 's1',
  unitCode: 'U05',
  leaf: 1,
  playedOn: TODAY,
  completedAt: `${TODAY}T10:00:00.000Z`,
  itemsHeard: [],
  isNew: true,
  status: 'pending',
  attempts: 0,
  nextAttemptAt: 0,
  ...overrides,
});

describe('dates', () => {
  it('formats the device local date', () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('lists the week Monday to Sunday', () => {
    expect(weekDates(TODAY)).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ]);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('unlocking leaves at home', () => {
  it('opens only the next leaf, and old leaves always', () => {
    const progress = mergeProgress({ completed: [1, 2], newToday: 0 }, [], 's1', 'U05', TODAY);
    expect(progress.nextLeaf).toBe(3);
    expect(canStartLeaf(3, progress, 'home')).toEqual({ ok: true, isNew: true });
    expect(canStartLeaf(1, progress, 'home')).toEqual({ ok: true, isNew: false });
    expect(canStartLeaf(4, progress, 'home')).toEqual({ ok: false, reason: 'locked' });
    expect(canStartLeaf(0, progress, 'home')).toEqual({ ok: false, reason: 'locked' });
  });

  it('allows at most two new leaves a day, counting leaves not uploaded yet', () => {
    const logs = [log({ leaf: 1 }), log({ leaf: 2 })];
    const progress = mergeProgress(null, logs, 's1', 'U05', TODAY);
    expect(progress.completed).toEqual(new Set([1, 2]));
    expect(progress.newToday).toBe(2);
    expect(canStartLeaf(3, progress, 'home')).toEqual({ ok: false, reason: 'daily-limit' });
    expect(canStartLeaf(2, progress, 'home')).toEqual({ ok: true, isNew: false });
  });

  it('does not count a leaf twice when the server already has it', () => {
    const logs = [log({ leaf: 1, status: 'synced' })];
    const progress = mergeProgress({ completed: [1], newToday: 1 }, logs, 's1', 'U05', TODAY);
    expect(progress.newToday).toBe(1);
    expect(canStartLeaf(2, progress, 'home').ok).toBe(true);
  });

  it('ignores repeats, other days, other children, other units and refused leaves', () => {
    const logs = [
      log({ leaf: 1, isNew: false }),
      log({ leaf: 2, playedOn: '2026-10-27' }),
      log({ leaf: 3, studentId: 's2' }),
      log({ leaf: 4, unitCode: 'U04' }),
      log({ leaf: 5, status: 'rejected' }),
    ];
    const progress = mergeProgress({ completed: [1], newToday: 0 }, logs, 's1', 'U05', TODAY);
    expect(progress.completed).toEqual(new Set([1, 2]));
    expect(progress.newToday).toBe(0);
    expect(progress.nextLeaf).toBe(3);
  });

  it('opens every leaf at school', () => {
    const progress = mergeProgress(null, [], 's1', 'U05', TODAY);
    expect(canStartLeaf(17, progress, 'school')).toEqual({ ok: true, isNew: true });
    expect(leafState(17, progress, 'school', 17)).toBe('next');
    expect(leafState(18, progress, 'school', 17)).toBe('open');
  });

  it('shows done, next and locked leaves on the path', () => {
    const progress = mergeProgress({ completed: [1], newToday: 0 }, [], 's1', 'U05', TODAY);
    expect(leafState(1, progress, 'home')).toBe('done');
    expect(leafState(2, progress, 'home')).toBe('next');
    expect(leafState(3, progress, 'home')).toBe('locked');
  });

  it('keeps the last leaf playable when all 40 are done', () => {
    const all = Array.from({ length: 40 }, (_, index) => index + 1);
    const progress = mergeProgress({ completed: all, newToday: 2 }, [], 's1', 'U05', TODAY);
    expect(progress.nextLeaf).toBe(40);
    expect(canStartLeaf(40, progress, 'home')).toEqual({ ok: true, isNew: false });
  });

  it('lays the 40 leaves out in eight weeks of five', () => {
    const weeks = leafWeeks();
    expect(weeks).toHaveLength(8);
    expect(weeks[0]).toEqual([1, 2, 3, 4, 5]);
    expect(weeks[7]).toEqual([36, 37, 38, 39, 40]);
  });
});

describe('weekly days', () => {
  it('takes the larger of the server count and the days on this device, newest week first', () => {
    const days = localListeningDays(
      [
        log({ playedOn: '2026-10-26' }),
        log({ playedOn: '2026-10-28' }),
        log({ playedOn: '2026-10-28' }),
        log({ playedOn: '2026-10-20', status: 'synced' }),
        log({ playedOn: '2026-10-27', status: 'rejected' }),
        log({ playedOn: '2026-10-27', studentId: 's2' }),
      ],
      's1',
    );
    const weeks = recentWeeks(
      [
        { weekStart: '2026-10-26', days: 1 },
        { weekStart: '2026-10-19', days: 4 },
      ],
      days,
      TODAY,
    );
    expect(weeks).toHaveLength(8);
    expect(weeks[0]).toEqual({ weekStart: '2026-10-26', days: 2, goal: false });
    expect(weeks[1]).toEqual({ weekStart: '2026-10-19', days: 4, goal: true });
    expect(weeks[7]!.weekStart).toBe('2026-09-07');
  });
});

describe('times heard', () => {
  it('adds leaves waiting to upload to the server counts', () => {
    const heard = mergeHeard(
      { SG1: 3 },
      [
        log({ itemsHeard: ['SG1', 'RH1'] }),
        log({ itemsHeard: ['SG1'], status: 'synced' }),
        log({ itemsHeard: ['SG1'], unitCode: 'U04' }),
      ],
      's1',
      'U05',
    );
    expect(heard).toEqual({ SG1: 4, RH1: 1 });
  });
});

describe('class progress', () => {
  it('marks leaves the class played on this device', () => {
    const progress = classProgress(
      [
        { classId: 'k1', unitCode: 'U05', leaf: 1, status: 'synced' },
        { classId: 'k1', unitCode: 'U05', leaf: 2, status: 'pending' },
        { classId: 'k1', unitCode: 'U05', leaf: 3, status: 'rejected' },
        { classId: 'k2', unitCode: 'U05', leaf: 4, status: 'pending' },
      ],
      'k1',
      'U05',
    );
    expect(progress.completed).toEqual(new Set([1, 2]));
    expect(progress.nextLeaf).toBe(3);
  });
});
