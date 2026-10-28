import { Controller, Get, Query } from '@nestjs/common';
import type { Prisma } from '@little-ants/db';
import { CurrentUser } from '../auth/decorators.js';
import { canManageSchool, hasRole, type StaffUser } from '../auth/staff-access.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { today } from './org.service.js';
import { requireSchool } from './school-access.js';

/** Days in the listening chart, ending today (Vietnam time). */
const LISTENING_DAYS = 14;

/**
 * The Admin home page. Each part is only sent to people who may see it: content for HQ roles, the network of
 * schools for HQ admins, and one school for its school admins (and HQ admins).
 */
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client;
  }

  @Get()
  async dashboard(@CurrentUser() user: StaffUser, @Query('schoolId') schoolId?: string) {
    if (schoolId) requireSchool(user, schoolId, true);
    const [content, network, school] = await Promise.all([
      user.roles.length > 0 ? this.content() : null,
      hasRole(user, 'ADMIN') ? this.network() : null,
      schoolId && canManageSchool(user, schoolId) ? this.school(schoolId) : null,
    ]);
    return { content, network, school };
  }

  private async content() {
    const [byStatus, published, waitingReview, lastSync] = await Promise.all([
      this.db.unit.groupBy({ by: ['status'], _count: { _all: true } }),
      this.db.unit.count({ where: { releases: { some: {} } } }),
      this.db.unit.findMany({
        where: { status: 'REVIEW' },
        orderBy: { number: 'asc' },
        take: 5,
        select: { code: true, title: true, updatedAt: true },
      }),
      this.db.importRun.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { status: true, createdAt: true, finishedAt: true, message: true },
      }),
    ]);
    const units = { DRAFT: 0, REVIEW: 0, APPROVED: 0, ARCHIVED: 0 };
    for (const row of byStatus) units[row.status] = row._count._all;
    return { units, published, waitingReview, lastSync };
  }

  private async network() {
    const open = { endedOn: null, class: { status: 'ACTIVE' } } satisfies Prisma.EnrollmentWhereInput;
    const [schools, activeSchools, campuses, activeClasses, childrenInClass, parents] = await Promise.all([
      this.db.school.count(),
      this.db.school.count({ where: { active: true } }),
      this.db.campus.count({ where: { active: true } }),
      this.db.class.count({ where: { status: 'ACTIVE' } }),
      this.db.enrollment.count({ where: open }),
      this.db.parent.count({ where: { children: { some: { student: { enrollments: { some: open } } } } } }),
    ]);
    return { schools, activeSchools, campuses, activeClasses, childrenInClass, parents };
  }

  private async school(schoolId: string) {
    const open = {
      endedOn: null,
      class: { status: 'ACTIVE', campus: { schoolId } },
    } satisfies Prisma.EnrollmentWhereInput;
    const inClass = { enrollments: { some: open } } satisfies Prisma.StudentWhereInput;
    const parentOfChildHere = { children: { some: { student: inClass } } } satisfies Prisma.ParentWhereInput;
    const activeClass = { campus: { schoolId }, status: 'ACTIVE' } satisfies Prisma.ClassWhereInput;
    const end = today();
    const start = new Date(end.getTime() - (LISTENING_DAYS - 1) * 86_400_000);

    const [
      childrenInClass,
      parents,
      parentsSignedIn,
      staff,
      noConsent,
      noParent,
      classesWithoutTeacher,
      classesWithoutUnit,
      logs,
      classes,
    ] = await Promise.all([
      this.db.enrollment.count({ where: open }),
      this.db.parent.count({ where: parentOfChildHere }),
      this.db.parent.count({ where: { ...parentOfChildHere, sessions: { some: {} } } }),
      this.db.schoolStaff.count({ where: { schoolId } }),
      this.db.student.count({ where: { ...inClass, consentAt: null } }),
      this.db.student.count({ where: { ...inClass, parents: { none: {} } } }),
      this.db.class.count({ where: { ...activeClass, teachers: { none: {} } } }),
      this.db.class.count({ where: { ...activeClass, currentUnitId: null } }),
      this.db.listeningLog.findMany({
        where: { playedOn: { gte: start, lte: end }, student: inClass },
        select: { playedOn: true, studentId: true },
      }),
      this.db.class.findMany({
        where: activeClass,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          nextLesson: true,
          campus: { select: { name: true } },
          currentUnit: { select: { code: true, title: true } },
          _count: { select: { enrollments: { where: { endedOn: null } } } },
          lessonRuns: { orderBy: { taughtAt: 'desc' }, take: 1, select: { taughtAt: true } },
        },
      }),
    ]);

    // One entry per day, including days nobody listened.
    const days = new Map<string, { leaves: number; children: Set<string> }>();
    for (let index = 0; index < LISTENING_DAYS; index++)
      days.set(new Date(start.getTime() + index * 86_400_000).toISOString().slice(0, 10), {
        leaves: 0,
        children: new Set(),
      });
    for (const log of logs) {
      const day = days.get(log.playedOn.toISOString().slice(0, 10));
      if (!day) continue;
      day.leaves += 1;
      day.children.add(log.studentId);
    }

    return {
      totals: {
        activeClasses: classes.length,
        childrenInClass,
        parents,
        parentsSignedIn,
        staff,
      },
      attention: { noConsent, noParent, classesWithoutTeacher, classesWithoutUnit },
      listening: [...days].map(([day, { leaves, children }]) => ({ day, leaves, children: children.size })),
      classes: classes.map(({ _count, lessonRuns, ...klass }) => ({
        ...klass,
        children: _count.enrollments,
        lastTaughtAt: lessonRuns[0]?.taughtAt ?? null,
      })),
    };
  }
}
