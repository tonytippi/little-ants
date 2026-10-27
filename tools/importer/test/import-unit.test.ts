import { existsSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient, editContent, seedBaseData, type PrismaClient } from '@little-ants/db';
import { resetTestDatabase } from '@little-ants/db/testing';
import type { LevelRules } from '@little-ants/shared';
import { materialsForDesignFile } from '../src/media-plan.js';
import { discoverUnit, discoverUnitFolders, unitNumber } from '../src/discover.js';
import { parseUnit, type ParsedUnit } from '../src/parse-unit.js';
import { hasManualEdits, writeUnit } from '../src/write-unit.js';

// The curriculum source files are local-only (the Drive mirror, not in git), so this suite runs where they exist.
const programFolder = path.resolve(import.meta.dirname, '../../../docs/Little Ants English/LA 3-6');
const unitFolder = existsSync(programFolder)
  ? discoverUnitFolders(programFolder).find((folder) => unitNumber(path.basename(folder)) === 1)
  : undefined;
const hasSource = unitFolder !== undefined;

describe('materialsForDesignFile', () => {
  const materials = [
    { code: 'SG1', type: 'SONG' },
    { code: 'RH1', type: 'RHYME' },
    { code: 'MD1', type: 'MOVE_AND_DO' },
    { code: 'MD2', type: 'MOVE_AND_DO' },
    { code: 'ST1', type: 'STORY' },
  ];

  it('links single, family and poster files', () => {
    expect(materialsForDesignFile('U01_ST1_Who-Is-This_DRAFT (1).pdf', materials).map((m) => m.code)).toEqual(
      ['ST1'],
    );
    expect(
      materialsForDesignFile('U01_MD_Move-and-Do-Cards_DRAFT.pdf', materials).map((m) => m.code),
    ).toEqual(['MD1', 'MD2']);
    expect(materialsForDesignFile('U01_POSTERS_Songs_DRAFT.pdf', materials).map((m) => m.code)).toEqual([
      'SG1',
      'RH1',
    ]);
    expect(materialsForDesignFile('U01_XX_Unknown.pdf', materials)).toEqual([]);
  });
});

describe.skipIf(!hasSource)('Unit 1 import', () => {
  let prisma: PrismaClient;
  let parsed: ParsedUnit;

  beforeAll(async () => {
    prisma = createPrismaClient(await resetTestDatabase('test_importer'));
    await seedBaseData(prisma);
    const levels = await prisma.level.findMany();
    const rulesFor = (n: number): LevelRules =>
      (levels.find((level) => level.number === n)?.rules ?? {}) as LevelRules;
    parsed = await parseUnit(discoverUnit(unitFolder!), rulesFor);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('parses the whole unit without errors', () => {
    expect(parsed.issues.filter((issue) => issue.level === 'error')).toEqual([]);
    expect(parsed.sheet.overview).toMatchObject({
      code: 'U01',
      levelNumber: 1,
      title: 'Hello, Little Ants!',
    });
    expect(parsed.sheet.words.filter((word) => word.kind === 'CORE')).toHaveLength(40);
    expect(parsed.plans.lessons).toHaveLength(40);
    expect(parsed.pages.get('ST1')).toHaveLength(8);
    const lesson12 = parsed.plans.lessons.find((lesson) => lesson.number === 12)!;
    expect(lesson12).toMatchObject({ week: 3, stage: 'JOIN_IN', minutes: 30 });
    expect(lesson12.steps[1]).toMatchObject({ kind: 'CHANT', materialCode: 'CH2', minutes: 4 });
  });

  it('reports the repeated sound in lesson 12', () => {
    expect(parsed.issues).toContainEqual(
      expect.objectContaining({ where: 'lesson 12', message: expect.stringContaining('m /m/ twice') }),
    );
  });

  it('writes the same rows when run twice', async () => {
    const count = async (): Promise<number[]> =>
      Promise.all([
        prisma.unit.count(),
        prisma.word.count(),
        prisma.material.count(),
        prisma.materialPage.count(),
        prisma.lesson.count(),
        prisma.lessonStep.count(),
        prisma.prepItem.count(),
        prisma.canDoGoal.count(),
        prisma.gateCheck.count(),
        prisma.productionStatus.count(),
      ]);
    await writeUnit(prisma, parsed);
    const first = await count();
    await writeUnit(prisma, parsed);
    expect(await count()).toEqual(first);
    expect(first[4]).toBe(40);

    const unit = await prisma.unit.findUniqueOrThrow({
      where: { code: 'U01' },
      include: { leadCharacter: true },
    });
    expect(unit.leadCharacter?.name).toBe('Annie Ant');
    expect(unit.parentMessage).toContain('Dear parents');
  });

  it('notices edits made in Admin so a re-import does not overwrite them', async () => {
    expect(await hasManualEdits(prisma, 'U01')).toBe(false);
    const material = await prisma.material.findFirstOrThrow({
      where: { code: 'SG1', unit: { code: 'U01' } },
    });
    await editContent(
      prisma,
      'material',
      material.id,
      { teacherNotes: 'Sing slowly.' },
      { note: 'admin edit' },
    );
    expect(await hasManualEdits(prisma, 'U01')).toBe(true);
  });
});

describe.skipIf(!hasSource)('re-importing after review', () => {
  let prisma: PrismaClient;
  let parsed: ParsedUnit;

  beforeAll(async () => {
    prisma = createPrismaClient(await resetTestDatabase('test_importer'));
    await seedBaseData(prisma);
    const levels = await prisma.level.findMany();
    parsed = await parseUnit(
      discoverUnit(unitFolder!),
      (n) => (levels.find((level) => level.number === n)?.rules ?? {}) as LevelRules,
    );
    await writeUnit(prisma, parsed);
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('turns approved content into a new draft and keeps gate sign-offs', async () => {
    const unit = await prisma.unit.findUniqueOrThrow({ where: { code: 'U01' } });
    await prisma.material.updateMany({ where: { unitId: unit.id }, data: { status: 'APPROVED' } });
    const gate = await prisma.gateCheck.findFirstOrThrow({
      where: { unitId: unit.id },
      orderBy: [{ gate: 'asc' }, { order: 'asc' }],
    });
    await prisma.gateCheck.update({
      where: { id: gate.id },
      data: { done: true, signer: 'Program lead', doneAt: new Date('2026-10-20') },
    });

    await writeUnit(prisma, parsed);

    const sg1 = await prisma.material.findFirstOrThrow({ where: { unitId: unit.id, code: 'SG1' } });
    expect(sg1).toMatchObject({ status: 'DRAFT', version: 2 });
    const again = await prisma.gateCheck.findFirstOrThrow({
      where: { unitId: unit.id, gate: gate.gate, text: gate.text },
    });
    expect(again).toMatchObject({ done: true, signer: 'Program lead' });
  });
});
