import { Body, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { DAYS_PER_WEEK_GOAL, syncInput } from '@little-ants/shared';
import type { z } from 'zod';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { canAccessClass, teachableClasses, type StaffUser } from '../auth/staff-access.js';
import { ZodBody } from '../common/zod-body.js';
import { dayOrToday } from '../org/org.service.js';
import { requireClassAccess } from '../org/school-access.js';
import { ListeningService } from '../parents/listening.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { releasePictures } from '../releases/release-pictures.js';

/** Endpoints used by the Teacher app. Teachers see their own classes; school admins their school's; HQ all. */
@Controller('teach')
export class TeachController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly listening: ListeningService,
  ) {}

  private get db() {
    return this.prisma.client;
  }

  private async assertClass(user: StaffUser, classId: string): Promise<void> {
    await requireClassAccess(this.db, user, classId);
  }

  @Get('classes')
  async classes(@CurrentUser() user: StaffUser) {
    const classes = await this.db.class.findMany({
      where: { status: 'ACTIVE', ...teachableClasses(user) },
      orderBy: { name: 'asc' },
      include: {
        campus: { select: { name: true } },
        level: { select: { number: true, name: true } },
        currentUnit: {
          select: {
            code: true,
            title: true,
            releases: { orderBy: { version: 'desc' }, take: 1, select: { version: true, publishedAt: true } },
          },
        },
        enrollments: {
          where: { endedOn: null },
          orderBy: { student: { displayName: 'asc' } },
          select: { student: { select: { id: true, displayName: true } } },
        },
      },
    });
    const pictures = await releasePictures(this.db);
    return classes.map(({ currentUnit, enrollments, ...rest }) => ({
      ...rest,
      students: enrollments.map((enrollment) => enrollment.student),
      currentUnit: currentUnit
        ? {
            code: currentUnit.code,
            title: currentUnit.title,
            release: currentUnit.releases[0] ?? null,
            picture: pictures.get(currentUnit.code) ?? null,
          }
        : null,
    }));
  }

  /** Published units a teacher can open (the latest version of each). */
  @Get('units')
  async units() {
    const units = await this.db.unit.findMany({
      where: { releases: { some: {} } },
      orderBy: { number: 'asc' },
      select: {
        code: true,
        number: true,
        title: true,
        level: { select: { number: true, name: true } },
        releases: { orderBy: { version: 'desc' }, take: 1, select: { version: true, publishedAt: true } },
      },
    });
    const pictures = await releasePictures(this.db);
    return units.map(({ releases, ...unit }) => ({
      ...unit,
      release: releases[0]!,
      picture: pictures.get(unit.code) ?? null,
    }));
  }

  @Get('units/:code/release')
  async release(@Param('code') code: string) {
    const release = await this.db.unitRelease.findFirst({
      where: { unit: { code: code.toUpperCase() } },
      orderBy: { version: 'desc' },
      select: { payload: true },
    });
    if (!release) throw new NotFoundException('This unit has not been published yet');
    return release.payload;
  }

  /** Latest result per child and goal for a unit. */
  @Get('classes/:id/observations')
  async observations(
    @CurrentUser() user: StaffUser,
    @Param('id') classId: string,
    @Query('unit') unitCode: string,
  ) {
    await this.assertClass(user, classId);
    const rows = await this.db.observation.findMany({
      where: { classId, unitCode: unitCode?.toUpperCase() },
      orderBy: { observedAt: 'desc' },
      select: { studentId: true, goalOrder: true, level: true, observedAt: true, lessonNumber: true },
    });
    const latest = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      const key = `${row.studentId}:${row.goalOrder}`;
      if (!latest.has(key)) latest.set(key, row);
    }
    return [...latest.values()];
  }

  /**
   * Home listening of the class's children: days with listening per week (last 8 weeks, newest first) and
   * how many reached the weekly goal this week (the program aims for 80% of the class).
   */
  @Get('classes/:id/listening')
  async classListening(
    @CurrentUser() user: StaffUser,
    @Param('id') classId: string,
    @Query('today') day?: string,
  ) {
    await this.assertClass(user, classId);
    const date = dayOrToday(day);
    const enrolled = await this.db.enrollment.findMany({
      where: { classId, endedOn: null },
      orderBy: { student: { displayName: 'asc' } },
      select: { student: { select: { id: true, displayName: true, _count: { select: { parents: true } } } } },
    });
    const weeks = await this.listening.weeks(
      enrolled.map((row) => row.student.id),
      date,
    );
    const children = enrolled.map(({ student }) => ({
      id: student.id,
      displayName: student.displayName,
      hasParent: student._count.parents > 0,
      weeks: weeks.get(student.id) ?? [],
    }));
    const reached = children.filter((child) => (child.weeks[0]?.days ?? 0) >= DAYS_PER_WEEK_GOAL).length;
    return { goalDays: DAYS_PER_WEEK_GOAL, reachedThisWeek: reached, children };
  }

  @Get('classes/:id/runs')
  async runs(@CurrentUser() user: StaffUser, @Param('id') classId: string, @Query('unit') unitCode?: string) {
    await this.assertClass(user, classId);
    return this.db.lessonRun.findMany({
      where: { classId, ...(unitCode ? { unitCode: unitCode.toUpperCase() } : {}) },
      orderBy: { taughtAt: 'desc' },
      take: 200,
      include: { teacher: { select: { name: true } } },
    });
  }

  /**
   * Upload records made on a device (possibly offline). Safe to retry: records are keyed by clientId.
   * Each record is accepted or rejected on its own, so one bad record never blocks the rest.
   * Recording a lesson of the class's current unit moves the class on to the next lesson.
   */
  @Post('sync')
  async sync(
    @CurrentUser() user: StaffUser,
    @Body(new ZodBody(syncInput)) body: z.infer<typeof syncInput>,
  ): Promise<SyncResult> {
    const rejected: SyncResult['rejected'] = [];
    const classIds = [
      ...new Set([
        ...body.lessonRuns.map((run) => run.classId),
        ...body.observations.map((obs) => obs.classId),
        ...body.listeningRuns.map((run) => run.classId),
      ]),
    ];
    const allowed = new Set<string>();
    for (const classId of classIds) if (await canAccessClass(this.db, user, classId)) allowed.add(classId);

    const runs = body.lessonRuns.filter((run) => {
      if (allowed.has(run.classId)) return true;
      rejected.push({ clientId: run.clientId, reason: 'Not your class' });
      return false;
    });
    const listeningRuns = body.listeningRuns.filter((run) => {
      if (allowed.has(run.classId)) return true;
      rejected.push({ clientId: run.clientId, reason: 'Not your class' });
      return false;
    });
    // Observations are for children in the class now (an open enrollment).
    const enrolled = await this.db.enrollment.findMany({
      where: {
        endedOn: null,
        studentId: { in: [...new Set(body.observations.map((obs) => obs.studentId))] },
      },
      select: { studentId: true, classId: true },
    });
    const studentClass = new Map(enrolled.map((row) => [row.studentId, row.classId]));
    const observations = body.observations.filter((obs) => {
      if (!allowed.has(obs.classId)) rejected.push({ clientId: obs.clientId, reason: 'Not your class' });
      else if (studentClass.get(obs.studentId) !== obs.classId)
        rejected.push({ clientId: obs.clientId, reason: 'The child is not in this class' });
      else return true;
      return false;
    });

    await this.db.$transaction(async (tx) => {
      const existing = new Set(
        (
          await tx.lessonRun.findMany({
            where: { clientId: { in: runs.map((run) => run.clientId) } },
            select: { clientId: true },
          })
        ).map((row) => row.clientId),
      );
      await tx.lessonRun.createMany({
        data: runs.map((run) => ({ ...run, teacherId: user.id })),
        skipDuplicates: true,
      });
      await tx.observation.createMany({
        data: observations.map((item) => ({ ...item, teacherId: user.id })),
        skipDuplicates: true,
      });
      await tx.classListeningRun.createMany({
        data: listeningRuns.map((run) => ({ ...run, teacherId: user.id })),
        skipDuplicates: true,
      });
      // Only newly recorded lessons move the class on, and never backwards (one atomic conditional update).
      for (const run of runs.filter((item) => !existing.has(item.clientId))) {
        await tx.class.updateMany({
          where: {
            id: run.classId,
            nextLesson: { lte: run.lessonNumber },
            currentUnit: { code: run.unitCode },
          },
          data: { nextLesson: Math.min(run.lessonNumber + 1, 40) },
        });
      }
    });
    return {
      accepted: [...runs, ...observations, ...listeningRuns].map((item) => item.clientId),
      rejected,
    };
  }
}

export interface SyncResult {
  /** Stored now or already stored earlier. */
  accepted: string[];
  rejected: { clientId: string; reason: string }[];
}

/** Teacher notes for program leads (Admin), newest first. */
@Roles('AUTHOR', 'REVIEWER')
@Controller('content/units/:code/teacher-notes')
export class TeacherNotesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  notes(@Param('code') code: string) {
    return this.prisma.client.lessonRun.findMany({
      where: { unitCode: code.toUpperCase(), notes: { not: '' } },
      orderBy: [{ lessonNumber: 'asc' }, { taughtAt: 'desc' }],
      include: { teacher: { select: { name: true } }, class: { select: { name: true } } },
    });
  }
}
