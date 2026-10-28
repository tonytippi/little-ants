import type { Prisma, PrismaClient, Role, SchoolRole } from '@little-ants/db';

export interface StaffUser {
  id: string;
  email: string;
  name: string;
  image: string | null;
  /** Little Ants HQ roles. */
  roles: Role[];
  /** Active schools the person works at, with their role there. */
  schools: { schoolId: string; role: SchoolRole }[];
}

export class NotInvitedError extends Error {
  constructor() {
    super('This email has not been invited');
  }
}

export class DeactivatedError extends Error {
  constructor() {
    super('This account is deactivated');
  }
}

/** The staff user with this id, or null when the account is missing or deactivated. */
export async function loadStaffUser(prisma: PrismaClient, id: string): Promise<StaffUser | null> {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      roles: true,
      active: true,
      schools: { where: { school: { active: true } }, select: { schoolId: true, role: true } },
    },
  });
  if (!user?.active) return null;
  const { active: _active, ...staff } = user;
  return staff;
}

/** Only invited emails may create an account. */
export async function assertInvited(prisma: PrismaClient, email: string): Promise<void> {
  const invite = await prisma.staffInvite.findUnique({ where: { email: email.toLowerCase() } });
  if (!invite) throw new NotInvitedError();
}

/** Give a new user the roles and school membership from their invite and mark the invite as used. */
export async function acceptInvite(prisma: PrismaClient, userId: string, email: string): Promise<void> {
  const invite = await prisma.staffInvite.findUnique({ where: { email: email.toLowerCase() } });
  if (!invite) return;
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { roles: invite.roles } }),
    ...(invite.schoolId && invite.schoolRole
      ? [
          prisma.schoolStaff.create({
            data: { userId, schoolId: invite.schoolId, role: invite.schoolRole },
          }),
        ]
      : []),
    prisma.staffInvite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } }),
    prisma.auditLog.create({ data: { actorId: userId, action: 'invite-accepted', target: email } }),
  ]);
}

export async function assertActive(prisma: PrismaClient, userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { active: true } });
  if (!user?.active) throw new DeactivatedError();
}

export function hasRole(user: Pick<StaffUser, 'roles'>, ...roles: Role[]): boolean {
  return user.roles.some((role) => roles.includes(role));
}

/** Someone who may use the staff apps: an HQ role or a role at an active school. */
export function isStaff(user: Pick<StaffUser, 'roles' | 'schools'>): boolean {
  return user.roles.length > 0 || user.schools.length > 0;
}

/** The person's role at a school; HQ admins act as school admins everywhere. */
export function schoolRole(user: StaffUser, schoolId: string): SchoolRole | null {
  if (hasRole(user, 'ADMIN')) return 'SCHOOL_ADMIN';
  return user.schools.find((school) => school.schoolId === schoolId)?.role ?? null;
}

/** May run the school: campuses, classes, children, parents and staff. */
export function canManageSchool(user: StaffUser, schoolId: string): boolean {
  return schoolRole(user, schoolId) === 'SCHOOL_ADMIN';
}

/** HQ admins and school admins see every class of their school; teachers the classes they are assigned to. */
export async function canAccessClass(
  prisma: PrismaClient,
  user: StaffUser,
  classId: string,
): Promise<boolean> {
  const found = await prisma.class.findUnique({
    where: { id: classId },
    select: {
      campus: { select: { schoolId: true } },
      teachers: { where: { userId: user.id }, select: { id: true } },
    },
  });
  if (!found) return false;
  const role = schoolRole(user, found.campus.schoolId);
  return role === 'SCHOOL_ADMIN' || (role === 'TEACHER' && found.teachers.length > 0);
}

/** Filter for the classes someone may teach: every class for HQ admins, all classes of the schools they run,
 * and their assigned classes at schools where they teach. */
export function teachableClasses(user: StaffUser): Prisma.ClassWhereInput {
  if (hasRole(user, 'ADMIN')) return {};
  const runs = user.schools
    .filter((school) => school.role === 'SCHOOL_ADMIN')
    .map((school) => school.schoolId);
  const teaches = user.schools.filter((school) => school.role === 'TEACHER').map((school) => school.schoolId);
  return {
    OR: [
      { campus: { schoolId: { in: runs } } },
      { campus: { schoolId: { in: teaches } }, teachers: { some: { userId: user.id } } },
    ],
  };
}
