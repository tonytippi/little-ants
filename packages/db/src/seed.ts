import path from 'node:path';
import { config } from 'dotenv';
import { DEFAULT_ADMIN_EMAIL, createPrismaClient, seedBaseData, seedDefaultAdmin } from './index.js';

config({ path: path.resolve(import.meta.dirname, '../../../.env'), quiet: true });

async function main(): Promise<void> {
  const prisma = createPrismaClient();
  try {
    await seedBaseData(prisma);
    const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim() || DEFAULT_ADMIN_EMAIL;
    const admin = await seedDefaultAdmin(prisma, adminEmail);
    const [programs, levels, characters] = await Promise.all([
      prisma.program.count(),
      prisma.level.count(),
      prisma.character.count(),
    ]);
    console.log(`Seed done. Database now has ${programs} programs, ${levels} levels, ${characters} characters.`);
    console.log(admin === 'invited' ? `Admin ${adminEmail} invited (sign in with Google).` : `Admin ${adminEmail} already has an account; staff roles ensured.`);
  } finally {
    await prisma.$disconnect();
  }
}

await main();
