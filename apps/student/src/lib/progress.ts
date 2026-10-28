/**
 * Listening progress on the device: the same rules the server applies (leaves open in order, at most two new
 * leaves a local day, old leaves always replayable), worked out from the last server summary plus the leaves
 * finished on this device that the server may not have yet. Pure functions, so they also run offline and in tests.
 */
import {
  DAYS_PER_WEEK_GOAL,
  LISTENING_LEAF_COUNT,
  NEW_LEAVES_PER_DAY,
  nextOpenLeaf,
  weekStart,
  type ListeningSummary,
} from '@little-ants/shared';
import type { Mode } from './types';

/** A leaf finished on this device (also the outbox record that uploads it). */
export interface LocalLog {
  clientId: string;
  studentId: string;
  unitCode: string;
  leaf: number;
  /** The device's local date, YYYY-MM-DD. */
  playedOn: string;
  completedAt: string;
  itemsHeard: string[];
  /** The leaf was opened for the first time (counts toward the daily limit). */
  isNew: boolean;
  /** pending = waiting to upload, synced = stored by the server, rejected = the server refused it. */
  status: 'pending' | 'synced' | 'rejected';
  reason?: string;
  attempts: number;
  nextAttemptAt: number;
}

/** The device's local date as YYYY-MM-DD (the date the child sees, used for the daily limit). */
export function localDay(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Adds days to a YYYY-MM-DD date. */
export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** The seven dates (Monday first) of the week `day` falls in. */
export function weekDates(day: string): string[] {
  const monday = weekStart(day);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

export interface LeafProgress {
  completed: Set<number>;
  /** New leaves opened today (local date). */
  newToday: number;
  /** The leaf to play next at home. */
  nextLeaf: number;
}

const counted = (log: LocalLog): boolean => log.status !== 'rejected';

/**
 * Progress for one unit: leaves the server knows plus those finished here (uploaded or not).
 * New-leaves-today takes the larger of the two counts, so a leaf counted by both is never counted twice.
 */
export function mergeProgress(
  summary: Pick<ListeningSummary, 'completed' | 'newToday'> | null | undefined,
  logs: LocalLog[],
  studentId: string,
  unitCode: string,
  today: string,
): LeafProgress {
  const completed = new Set(summary?.completed ?? []);
  let localNewToday = 0;
  for (const log of logs) {
    if (log.studentId !== studentId || log.unitCode !== unitCode || !counted(log)) continue;
    completed.add(log.leaf);
    if (log.isNew && log.playedOn === today) localNewToday += 1;
  }
  return {
    completed,
    newToday: Math.max(summary?.newToday ?? 0, localNewToday),
    nextLeaf: nextOpenLeaf(completed),
  };
}

export type LeafState = 'done' | 'next' | 'open' | 'locked';

/** How a leaf looks on the path. At school every leaf is open; `selected` is the lesson's leaf. */
export function leafState(leaf: number, progress: LeafProgress, mode: Mode, selected?: number): LeafState {
  if (progress.completed.has(leaf)) return 'done';
  if (mode === 'school') return leaf === selected ? 'next' : 'open';
  return leaf === progress.nextLeaf ? 'next' : 'locked';
}

export type StartCheck = { ok: true; isNew: boolean } | { ok: false; reason: 'locked' | 'daily-limit' };

/** Whether a leaf may start now: at home only the next leaf (two new leaves a day) or one already done. */
export function canStartLeaf(leaf: number, progress: LeafProgress, mode: Mode): StartCheck {
  if (leaf < 1 || leaf > LISTENING_LEAF_COUNT) return { ok: false, reason: 'locked' };
  if (progress.completed.has(leaf)) return { ok: true, isNew: false };
  if (mode === 'school') return { ok: true, isNew: true };
  if (leaf !== progress.nextLeaf) return { ok: false, reason: 'locked' };
  if (progress.newToday >= NEW_LEAVES_PER_DAY) return { ok: false, reason: 'daily-limit' };
  return { ok: true, isNew: true };
}

/** The 40 leaves in week rows of five (Week 1 = leaves 1–5). */
export function leafWeeks(): number[][] {
  const weeks: number[][] = [];
  for (let start = 1; start <= LISTENING_LEAF_COUNT; start += 5)
    weeks.push(Array.from({ length: 5 }, (_, index) => start + index));
  return weeks;
}

/** Days with listening on this device (any unit) for a child. */
export function localListeningDays(logs: LocalLog[], studentId: string): Set<string> {
  return new Set(
    logs.filter((log) => log.studentId === studentId && counted(log)).map((log) => log.playedOn),
  );
}

export interface WeekCount {
  weekStart: string;
  days: number;
  /** Reached the weekly goal (4 days). */
  goal: boolean;
}

/**
 * Days with listening per week, the `count` weeks up to `today`, newest first. Takes the larger of the
 * server's count and this device's days, so leaves still waiting to upload show at once.
 */
export function recentWeeks(
  serverWeeks: ListeningSummary['weeks'] | undefined,
  localDays: Set<string>,
  today: string,
  count = 8,
): WeekCount[] {
  const server = new Map((serverWeeks ?? []).map((week) => [week.weekStart, week.days]));
  const monday = weekStart(today);
  return Array.from({ length: count }, (_, index) => {
    const start = addDays(monday, -7 * index);
    const local = weekDates(start).filter((day) => localDays.has(day)).length;
    const days = Math.max(server.get(start) ?? 0, local);
    return { weekStart: start, days, goal: days >= DAYS_PER_WEEK_GOAL };
  });
}

/** Times each item was heard: the server's counts plus leaves on this device not uploaded yet. */
export function mergeHeard(
  serverHeard: Record<string, number> | undefined,
  logs: LocalLog[],
  studentId: string,
  unitCode: string,
): Record<string, number> {
  const heard = { ...(serverHeard ?? {}) };
  for (const log of logs) {
    if (log.studentId !== studentId || log.unitCode !== unitCode || log.status !== 'pending') continue;
    for (const key of log.itemsHeard) heard[key] = (heard[key] ?? 0) + 1;
  }
  return heard;
}

/** At school: the leaves this class has played on this device (all leaves stay open). */
export function classProgress(
  runs: { classId: string; unitCode: string; leaf: number; status: LocalLog['status'] }[],
  classId: string,
  unitCode: string,
): LeafProgress {
  const completed = new Set(
    runs
      .filter((run) => run.classId === classId && run.unitCode === unitCode && run.status !== 'rejected')
      .map((run) => run.leaf),
  );
  return { completed, newToday: 0, nextLeaf: nextOpenLeaf(completed) };
}
