import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { syncInput } from '@little-ants/shared';
import type { z } from 'zod';
import { CurrentUser, Roles } from '../auth/decorators.js';
import { canAccessClass, hasRole, type StaffUser } from '../auth/staff-access.js';
import { ZodBody } from '../common/zod-body.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Endpoints used by the Teacher app. Teachers see their own classes; admins see all. */
@Roles('TEACHER')
@Controller('teach')
export class TeachController {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client;
  }

  private async assertClass(user: StaffUser, classId: string): Promise<void> {
    if (!(await canAccessClass(this.db, user, classId))) throw new ForbiddenException('Not your class');
  }

  @Get('classes')
  async classes(@CurrentUser() user: StaffUser) {
    const classes = await this.db.class.findMany({
      where: { active: true, ...(hasRole(user, 'ADMIN') ? {} : { teachers: { some: { userId: user.id } } }) },
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
        students: {
          where: { status: 'ACTIVE' },
          orderBy: { displayName: 'asc' },
          select: { id: true, displayName: true },
        },
      },
    });
    return classes.map(({ currentUnit, ...rest }) => ({
      ...rest,
      currentUnit: currentUnit
        ? { code: currentUnit.code, title: currentUnit.title, release: currentUnit.releases[0] ?? null }
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
    return units.map(({ releases, ...unit }) => ({ ...unit, release: releases[0]! }));
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
      ]),
    ];
    const allowed = new Set<string>();
    for (const classId of classIds) if (await canAccessClass(this.db, user, classId)) allowed.add(classId);

    const runs = body.lessonRuns.filter((run) => {
      if (allowed.has(run.classId)) return true;
      rejected.push({ clientId: run.clientId, reason: 'Not your class' });
      return false;
    });
    const students = await this.db.student.findMany({
      where: { id: { in: [...new Set(body.observations.map((obs) => obs.studentId))] } },
      select: { id: true, classId: true },
    });
    const studentClass = new Map(students.map((student) => [student.id, student.classId]));
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
    return { accepted: [...runs, ...observations].map((item) => item.clientId), rejected };
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
