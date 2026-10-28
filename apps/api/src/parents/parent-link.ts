import type { Prisma, PrismaClient } from '@little-ants/db';
import type { ParentLinkInput } from '@little-ants/shared';

/** Let a parent (by email) sign in for a child: the parent account is created on first use. */
export async function linkParent(
  db: PrismaClient | Prisma.TransactionClient,
  studentId: string,
  input: ParentLinkInput,
) {
  const parent = await db.parent.upsert({
    where: { email: input.email },
    update: {},
    create: { email: input.email },
  });
  const link = await db.studentParent.upsert({
    where: { studentId_parentId: { studentId, parentId: parent.id } },
    update: { relationship: input.relationship },
    create: { studentId, parentId: parent.id, relationship: input.relationship },
  });
  return { ...link, parent };
}
