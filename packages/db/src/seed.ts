import path from 'node:path';
import { config } from 'dotenv';
import { createPrismaClient, seedBaseData } from './index.js';

config({ path: path.resolve(import.meta.dirname, '../../../.env'), quiet: true });

async function main(): Promise<void> {
  const prisma = createPrismaClient();
  try {
    await seedBaseData(prisma);
    const [programs, levels, characters] = await Promise.all([
      prisma.program.count(),
      prisma.level.count(),
      prisma.character.count(),
    ]);
    console.log(`Seed done. Database now has ${programs} programs, ${levels} levels, ${characters} characters.`);
  } finally {
    await prisma.$disconnect();
  }
}

await main();
