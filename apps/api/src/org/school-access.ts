import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@little-ants/db';
import { canAccessClass, canManageSchool, schoolRole, type StaffUser } from '../auth/staff-access.js';

/**
 * Checks a person's access to a school in one place. A school the person does not work at answers 404, so
 * other schools' names and ids are not revealed; `manage` needs the school admin role.
 */
export function requireSchool(user: StaffUser, schoolId: string, manage = false): void {
  if (!schoolRole(user, schoolId)) throw new NotFoundException('School not found');
  if (manage && !canManageSchool(user, schoolId))
    throw new ForbiddenException('Only school admins can change this');
}

/** The school a class belongs to (404 when the class does not exist). */
export async function schoolOfClass(prisma: PrismaClient, classId: string): Promise<string> {
  const found = await prisma.class.findUnique({
    where: { id: classId },
    select: { campus: { select: { schoolId: true } } },
  });
  if (!found) throw new NotFoundException('Class not found');
  return found.campus.schoolId;
}

/** Someone may open this class: 404 for a class of a school they do not work at, 403 for a colleague's. */
export async function requireClassAccess(
  prisma: PrismaClient,
  user: StaffUser,
  classId: string,
): Promise<void> {
  const schoolId = await schoolOfClass(prisma, classId);
  if (!schoolRole(user, schoolId)) throw new NotFoundException('Class not found');
  if (!(await canAccessClass(prisma, user, classId))) throw new ForbiddenException('Not your class');
}

/**
 * A child's enrollments, latest first: the open one, else the last to end. Moving and leaving on the same day
 * ends two enrollments on one date, so the order they were created in breaks the tie.
 */
export const LATEST_ENROLLMENT_FIRST = [
  { endedOn: { sort: 'desc', nulls: 'first' } },
  { startedOn: 'desc' },
  { createdAt: 'desc' },
] satisfies Prisma.EnrollmentOrderByWithRelationInput[];

/**
 * The school responsible for a child: where the child is now, else where they were last. Only that school
 * (and HQ) may change the child's record.
 */
export async function schoolOfStudent(prisma: PrismaClient, studentId: string): Promise<string> {
  const enrollment = await prisma.enrollment.findFirst({
    where: { studentId },
    orderBy: LATEST_ENROLLMENT_FIRST,
    select: { class: { select: { campus: { select: { schoolId: true } } } } },
  });
  if (!enrollment) throw new NotFoundException('Child not found');
  return enrollment.class.campus.schoolId;
}
