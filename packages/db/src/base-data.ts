import type { PrismaClient } from './generated/prisma/client.js';

/** Levels and rules from 00_LA_Program-Plan_Ages-3-6 (section 2). */
const LA_LEVELS = [
  {
    number: 1,
    name: 'Little Ants',
    ageBand: '3–4 years',
    lessonMinutes: '25–30',
    maxClassSize: 10,
    rules: { coreWordsPerUnit: [35, 40], storyPages: [6, 8], sentencesPerPage: [1, 1], soundsPerUnit: [2, 3] },
  },
  {
    number: 2,
    name: 'Busy Ants',
    ageBand: '4–5 years',
    lessonMinutes: '30–35',
    maxClassSize: 12,
    rules: { coreWordsPerUnit: [40, 45], storyPages: [8, 8], sentencesPerPage: [1, 2], maxWordsPerPage: 12 },
  },
  {
    number: 3,
    name: 'Big Ants',
    ageBand: '5–6 years',
    lessonMinutes: '35–40',
    maxClassSize: 14,
    rules: { coreWordsPerUnit: [40, 50], storyPages: [10, 10], sentencesPerPage: [2, 3] },
  },
];

/** The Ant Hill friends (01_BRAND/Characters/FINAL). */
const CHARACTERS = [
  ['CHAR_01', 'Annie Ant'],
  ['CHAR_02', 'Tiny Ant'],
  ['CHAR_03', 'Mama Ant'],
  ['CHAR_04', 'Papa Ant'],
  ['CHAR_05', 'Grandma Ant'],
  ['CHAR_06', 'Grandpa Ant'],
  ['CHAR_07', 'Lulu Ladybug'],
  ['CHAR_08', 'Hoppy Grasshopper'],
  ['CHAR_09', 'Buzz Bee'],
  ['CHAR_10', 'Sami Snail'],
  ['CHAR_11', 'Freddy Frog'],
  ['CHAR_12', 'Pip'],
  ['CHAR_12b', 'Pip (butterfly)'],
  ['CHAR_13', 'Mai'],
  ['CHAR_14', 'Bao'],
] as const;

/** Program, levels and characters every environment needs. Safe to run many times. */
export async function seedBaseData(prisma: PrismaClient): Promise<void> {
  const program = await prisma.program.upsert({
    where: { code: 'LA' },
    update: { name: 'Little Ants English 3–6' },
    create: { code: 'LA', name: 'Little Ants English 3–6' },
  });
  for (const level of LA_LEVELS) {
    await prisma.level.upsert({
      where: { programId_number: { programId: program.id, number: level.number } },
      update: level,
      create: { ...level, programId: program.id },
    });
  }
  for (const [code, name] of CHARACTERS) {
    await prisma.character.upsert({ where: { code }, update: { name }, create: { code, name } });
  }
}
