import type { Prisma, PrismaClient } from '@little-ants/db';

export async function audit(
  prisma: PrismaClient | Prisma.TransactionClient,
  actorId: string,
  action: string,
  target: string,
  details: Record<string, unknown> = {},
): Promise<void> {
  await prisma.auditLog.create({
    data: { actorId, action, target, details: details as Prisma.InputJsonValue },
  });
}
