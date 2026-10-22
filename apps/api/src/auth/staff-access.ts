import type { PrismaClient, Role } from '@little-ants/db';

export interface StaffUser {
  id: string;
  email: string;
  name: string;
  image: string | null;
  roles: Role[];
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

/** Only invited emails may create an account. */
export async function assertInvited(prisma: PrismaClient, email: string): Promise<void> {
  const invite = await prisma.staffInvite.findUnique({ where: { email: email.toLowerCase() } });
  if (!invite) throw new NotInvitedError();
}

/** Give a new user the roles from their invite and mark the invite as used. */
export async function acceptInvite(prisma: PrismaClient, userId: string, email: string): Promise<void> {
  const invite = await prisma.staffInvite.findUnique({ where: { email: email.toLowerCase() } });
  if (!invite) return;
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { roles: invite.roles } }),
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

/** Admins see every class; teachers see the classes they are assigned to. */
export async function canAccessClass(
  prisma: PrismaClient,
  user: StaffUser,
  classId: string,
): Promise<boolean> {
  if (hasRole(user, 'ADMIN')) return true;
  if (!hasRole(user, 'TEACHER')) return false;
  const assignment = await prisma.teacherAssignment.findUnique({
    where: { userId_classId: { userId: user.id, classId } },
    select: { id: true },
  });
  return assignment !== null;
}
