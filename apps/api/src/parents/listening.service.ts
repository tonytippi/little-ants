import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  NEW_LEAVES_PER_DAY,
  listeningPayload,
  nextOpenLeaf,
  weekStart,
  type ListeningPayload,
  type ListeningSummary,
  type ListeningSyncInput,
  type UnitReleasePayload,
} from '@little-ants/shared';
import type { Prisma } from '@little-ants/db';
import { OrgService, today } from '../org/org.service.js';

const WEEKS_SHOWN = 8;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Devices' clocks may run a little fast. */
const CLOCK_SKEW_MS = 10 * 60 * 1000;

interface Progress {
  completed: Set<number>;
  newPerDay: Map<string, number>;
}
const day = (date: Date): string => date.toISOString().slice(0, 10);

/** Home listening: what a child may play, and their progress (recorded on devices, synced here). */
@Injectable()
export class ListeningService {
  constructor(private readonly org: OrgService) {}

  private get db() {
    return this.org.db;
  }

  /** The units a parent may open for this child (their linked child, still in a class). */
  async childUnits(parentId: string, studentId: string): Promise<Map<string, string>> {
    const link = await this.db.studentParent.findUnique({
      where: { studentId_parentId: { studentId, parentId } },
      select: { id: true },
    });
    if (!link) throw new NotFoundException('Child not found');
    const access = await this.org.studentAccess(studentId);
    if (!access.active) throw new ForbiddenException('This child is not in a class any more');
    const units = await this.db.unit.findMany({
      where: { id: { in: access.unitIds } },
      select: { id: true, code: true },
    });
    return new Map(units.map((unit) => [unit.code, unit.id]));
  }

  async payload(parentId: string, studentId: string, unitCode: string): Promise<ListeningPayload> {
    const units = await this.childUnits(parentId, studentId);
    const unitId = units.get(unitCode.toUpperCase());
    if (!unitId) throw new NotFoundException('This unit is not open for this child');
    const release = await this.db.unitRelease.findFirst({
      where: { unitId },
      orderBy: { version: 'desc' },
      select: { payload: true },
    });
    const listening = release ? listeningPayload(release.payload as unknown as UnitReleasePayload) : null;
    if (!listening) throw new NotFoundException('Listening Time is not ready for this unit yet');
    return listening;
  }

  /**
   * Stores leaves finished on a device. Repeats are always accepted; a new leaf must be the next one in order
   * and at most two new leaves count per day (the device's date). Each record is accepted or rejected alone.
   * The device's date must match when the leaf was finished (within a day, Vietnam time) and not lie in the
   * future, and syncs of one child run one at a time, so the daily limit holds across devices.
   */
  async sync(parentId: string, sessionId: string, studentId: string, body: ListeningSyncInput) {
    const units = await this.childUnits(parentId, studentId);
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'listening:' + studentId}))`;
      const rejected: { clientId: string; reason: string }[] = [];
      const accepted: string[] = [];
      const existing = new Set(
        (
          await tx.listeningLog.findMany({
            where: { studentId, clientId: { in: body.logs.map((log) => log.clientId) } },
            select: { clientId: true },
          })
        ).map((row) => row.clientId),
      );
      const progress = new Map<string, Progress>();
      const latest = Date.now() + CLOCK_SKEW_MS;
      const ordered = [...body.logs].sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime());
      const rows = [];
      for (const log of ordered) {
        if (existing.has(log.clientId)) {
          accepted.push(log.clientId);
          continue;
        }
        if (!units.has(log.unitCode)) {
          rejected.push({ clientId: log.clientId, reason: 'This unit is not open for this child' });
          continue;
        }
        const finishedOn = Date.parse(day(today(log.completedAt)));
        if (log.completedAt.getTime() > latest || Math.abs(Date.parse(log.playedOn) - finishedOn) > DAY_MS) {
          rejected.push({ clientId: log.clientId, reason: 'The date on the device does not match' });
          continue;
        }
        let state = progress.get(log.unitCode);
        if (!state) {
          state = await this.progress(studentId, log.unitCode, tx);
          progress.set(log.unitCode, state);
        }
        if (!state.completed.has(log.leaf)) {
          if (log.leaf !== nextOpenLeaf(state.completed)) {
            rejected.push({ clientId: log.clientId, reason: 'Leaves open one after another' });
            continue;
          }
          const opened = state.newPerDay.get(log.playedOn) ?? 0;
          if (opened >= NEW_LEAVES_PER_DAY) {
            rejected.push({ clientId: log.clientId, reason: 'At most two new leaves a day' });
            continue;
          }
          state.completed.add(log.leaf);
          state.newPerDay.set(log.playedOn, opened + 1);
        }
        rows.push({
          clientId: log.clientId,
          studentId,
          unitCode: log.unitCode,
          leaf: log.leaf,
          playedOn: new Date(`${log.playedOn}T00:00:00.000Z`),
          completedAt: log.completedAt,
          itemsHeard: log.itemsHeard,
          sessionId,
        });
        accepted.push(log.clientId);
      }
      await tx.listeningLog.createMany({ data: rows, skipDuplicates: true });
      return { accepted, rejected };
    });
  }

  /** Leaves finished so far and how many new leaves were opened on each day. */
  private async progress(
    studentId: string,
    unitCode: string,
    db: Prisma.TransactionClient = this.db,
  ): Promise<Progress> {
    const logs = await db.listeningLog.findMany({
      where: { studentId, unitCode },
      orderBy: { completedAt: 'asc' },
      select: { leaf: true, playedOn: true },
    });
    const completed = new Set<number>();
    const newPerDay = new Map<string, number>();
    for (const log of logs) {
      if (completed.has(log.leaf)) continue;
      completed.add(log.leaf);
      newPerDay.set(day(log.playedOn), (newPerDay.get(day(log.playedOn)) ?? 0) + 1);
    }
    return { completed, newPerDay };
  }

  async summary(
    parentId: string,
    studentId: string,
    unitCode: string,
    today: string,
  ): Promise<ListeningSummary> {
    const units = await this.childUnits(parentId, studentId);
    const code = unitCode.toUpperCase();
    if (!units.has(code)) throw new NotFoundException('This unit is not open for this child');
    const { completed, newPerDay } = await this.progress(studentId, code);
    const heard: Record<string, number> = {};
    for (const log of await this.db.listeningLog.findMany({
      where: { studentId, unitCode: code },
      select: { itemsHeard: true },
    }))
      for (const key of log.itemsHeard) heard[key] = (heard[key] ?? 0) + 1;
    return {
      unitCode: code,
      completed: [...completed].sort((a, b) => a - b),
      nextLeaf: nextOpenLeaf(completed),
      newToday: newPerDay.get(today) ?? 0,
      weeks: (await this.weeks([studentId], today)).get(studentId) ?? [],
      heard,
    };
  }

  /** Days with home listening per week for each child, the last eight weeks up to `today`, newest first. */
  async weeks(
    studentIds: string[],
    today: string,
  ): Promise<Map<string, { weekStart: string; days: number }[]>> {
    const starts: string[] = [];
    const monday = new Date(`${weekStart(today)}T00:00:00.000Z`);
    for (let index = 0; index < WEEKS_SHOWN; index += 1) {
      const start = new Date(monday);
      start.setUTCDate(monday.getUTCDate() - index * 7);
      starts.push(day(start));
    }
    const logs = await this.db.listeningLog.findMany({
      where: {
        studentId: { in: studentIds },
        playedOn: { gte: new Date(`${starts.at(-1)}T00:00:00.000Z`) },
      },
      distinct: ['studentId', 'playedOn'],
      select: { studentId: true, playedOn: true },
    });
    const result = new Map<string, { weekStart: string; days: number }[]>();
    for (const studentId of studentIds) {
      const days = logs
        .filter((log) => log.studentId === studentId)
        .map((log) => weekStart(day(log.playedOn)));
      result.set(
        studentId,
        starts.map((start) => ({ weekStart: start, days: days.filter((week) => week === start).length })),
      );
    }
    return result;
  }
}
