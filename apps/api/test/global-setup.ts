import { createPrismaClient, seedBaseData } from '@little-ants/db';
import { resetTestDatabase } from '@little-ants/db/testing';

export default async function setup(): Promise<void> {
  const url = await resetTestDatabase('test_api');
  const prisma = createPrismaClient(url);
  try {
    await seedBaseData(prisma);
  } finally {
    await prisma.$disconnect();
  }
}
