import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { EnrollmentEnd, Prisma } from '@little-ants/db';
import { localDateSchema } from '@little-ants/shared';
import { PrismaService } from '../prisma/prisma.service.js';

type Tx = Prisma.TransactionClient;

/** Today's date in Vietnam, as stored in date columns (midnight UTC of that day). */
export function today(now = new Date()): Date {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(now);
  return new Date(`${day}T00:00:00.000Z`);
}

/** An enrollment that gives access now: open, in an active class of an active school. */
export const OPEN_ENROLLMENT = {
  endedOn: null,
  class: { status: 'ACTIVE', campus: { school: { active: true } } },
} satisfies Prisma.EnrollmentWhereInput;

/** A device's date (YYYY-MM-DD) when it is a real date, else today in Vietnam. */
export function dayOrToday(value: string | undefined): string {
  return value && localDateSchema.safeParse(value).success ? value : today().toISOString().slice(0, 10);
}

/**
 * Classes work through units one at a time (ClassUnitRun) and children are in a class for a stretch of time
 * (Enrollment). Every change here closes the open row and opens a new one, so the history stays complete.
 */
@Injectable()
export class OrgService {
  constructor(private readonly prisma: PrismaService) {}

  get db() {
    return this.prisma.client;
  }

  private async activeClass(tx: Tx, classId: string) {
    const found = await tx.class.findUnique({
      where: { id: classId },
      select: { id: true, status: true, campus: { select: { schoolId: true } } },
    });
    if (!found) throw new NotFoundException('Class not found');
    if (found.status !== 'ACTIVE') throw new ConflictException('This class has ended');
    return found;
  }

  private async closeRun(tx: Tx, classId: string, on: Date): Promise<void> {
    await tx.classUnitRun.updateMany({ where: { classId, endedOn: null }, data: { endedOn: on } });
  }

  private async endEnrollments(
    tx: Tx,
    where: Prisma.EnrollmentWhereInput,
    reason: EnrollmentEnd,
    on: Date,
  ): Promise<string[]> {
    const open = await tx.enrollment.findMany({
      where: { ...where, endedOn: null },
      select: { studentId: true },
    });
    await tx.enrollment.updateMany({
      where: { ...where, endedOn: null },
      data: { endedOn: on, endReason: reason },
    });
    return open.map((row) => row.studentId);
  }

  /** Start a class on a unit: the first unit, or the next one after finishing the current unit. */
  async startUnit(classId: string, unitId: string, tx?: Tx): Promise<void> {
    const run = async (db: Tx): Promise<void> => {
      await this.activeClass(db, classId);
      const unit = await db.unit.findUnique({ where: { id: unitId }, select: { levelId: true } });
      if (!unit) throw new NotFoundException('Unit not found');
      const on = today();
      await this.closeRun(db, classId, on);
      await db.classUnitRun.create({ data: { classId, unitId, startedOn: on } });
      await db.class.update({
        where: { id: classId },
        data: { currentUnitId: unitId, nextLesson: 1, levelId: unit.levelId },
      });
    };
    if (tx) await run(tx);
    else await this.db.$transaction(run);
  }

  /** Put a child in a class from today. The child must not be in another class (move them instead). */
  async enroll(tx: Tx, studentId: string, classId: string): Promise<void> {
    await this.activeClass(tx, classId);
    const open = await tx.enrollment.findFirst({ where: { studentId, endedOn: null }, select: { id: true } });
    if (open) throw new ConflictException('This child is already in a class. Move the child instead.');
    await tx.enrollment.create({ data: { studentId, classId, startedOn: today() } });
  }

  /** Move a child to another class (any campus or school). */
  async moveStudent(studentId: string, classId: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
      const current = await tx.enrollment.findFirst({ where: { studentId, endedOn: null } });
      if (current?.classId === classId) throw new BadRequestException('The child is already in this class');
      await this.endEnrollments(tx, { studentId }, 'MOVED', today());
      await this.enroll(tx, studentId, classId);
    });
  }

  /** The child left: no class any more (and no access to the student app). */
  async leave(studentId: string): Promise<void> {
    const ended = await this.db.$transaction((tx) => this.endEnrollments(tx, { studentId }, 'LEFT', today()));
    if (ended.length === 0) throw new BadRequestException('This child is not in a class');
  }

  /** Move every child of `classId` into `targetClassId` and end the class. */
  async merge(classId: string, targetClassId: string): Promise<{ moved: number }> {
    if (classId === targetClassId) throw new BadRequestException('Choose another class to merge into');
    return this.db.$transaction(async (tx) => {
      const source = await this.activeClass(tx, classId);
      const target = await this.activeClass(tx, targetClassId);
      if (source.campus.schoolId !== target.campus.schoolId)
        throw new BadRequestException('Classes can only be merged within a school');
      const on = today();
      const students = await this.endEnrollments(tx, { classId }, 'MERGED', on);
      await tx.enrollment.createMany({
        data: students.map((studentId) => ({ studentId, classId: targetClassId, startedOn: on })),
      });
      await this.closeRun(tx, classId, on);
      await tx.class.update({
        where: { id: classId },
        data: { status: 'MERGED', mergedIntoId: targetClassId, endedAt: new Date() },
      });
      return { moved: students.length };
    });
  }

  /** End a class: its children leave it and its unit run closes. */
  async stop(classId: string): Promise<{ ended: number }> {
    return this.db.$transaction(async (tx) => {
      await this.activeClass(tx, classId);
      const on = today();
      const students = await this.endEnrollments(tx, { classId }, 'CLASS_STOPPED', on);
      await this.closeRun(tx, classId, on);
      await tx.class.update({ where: { id: classId }, data: { status: 'STOPPED', endedAt: new Date() } });
      return { ended: students.length };
    });
  }

  /**
   * What a child may open in the student app. Active = in a class now. Studied units = every unit a class of
   * theirs worked on while they were in it (including the current one); none once the child has left.
   */
  async studentAccess(studentId: string): Promise<{ active: boolean; unitIds: string[] }> {
    const enrollments = await this.db.enrollment.findMany({
      where: { studentId },
      select: {
        startedOn: true,
        endedOn: true,
        class: {
          select: {
            status: true,
            campus: { select: { school: { select: { active: true } } } },
            unitRuns: { select: { unitId: true, startedOn: true, endedOn: true } },
          },
        },
      },
    });
    const active = enrollments.some(
      (row) => row.endedOn === null && row.class.status === 'ACTIVE' && row.class.campus.school.active,
    );
    if (!active) return { active: false, unitIds: [] };
    const units = new Set<string>();
    for (const enrollment of enrollments) {
      for (const run of enrollment.class.unitRuns) {
        // Strict: a run that ended the day the child joined, or started the day they left, is not theirs; nor is
        // a run started and ended the same day (a unit started by mistake and corrected).
        if (run.endedOn && run.endedOn.getTime() === run.startedOn.getTime()) continue;
        const overlaps =
          (run.endedOn === null || run.endedOn > enrollment.startedOn) &&
          (enrollment.endedOn === null || run.startedOn < enrollment.endedOn);
        if (overlaps) units.add(run.unitId);
      }
    }
    return { active, unitIds: [...units] };
  }
}
