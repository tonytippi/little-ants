import { stateAfterEdit, type Prisma, type PrismaClient, type ProductionStage, type VersionedState } from '@little-ants/db';
import { materialTypeForCode } from './mapping.js';
import type { ParsedUnit } from './parse-unit.js';

export const IMPORT_NOTE = 'import';

export interface WriteResult {
  unitId: string;
  counts: Record<string, number>;
}

const ALL_STAGES: ProductionStage[] = [
  'TEXT',
  'ENGLISH_CHECK',
  'ILLUSTRATION',
  'LAYOUT',
  'AUDIO_VIDEO',
  'TEACHER_TEST',
  'PRINT_READY',
];

/** True when someone changed this unit in Admin after an import (any revision not written by the importer). */
export async function hasManualEdits(prisma: PrismaClient, unitCode: string): Promise<boolean> {
  const unit = await prisma.unit.findUnique({
    where: { code: unitCode },
    select: { id: true, words: { select: { id: true } }, materials: { select: { id: true } }, lessons: { select: { id: true } } },
  });
  if (!unit) return false;
  const ids = [unit.id, ...unit.words.map((w) => w.id), ...unit.materials.map((m) => m.id), ...unit.lessons.map((l) => l.id)];
  const manual = await prisma.revision.count({ where: { entityId: { in: ids }, note: { not: IMPORT_NOTE } } });
  return manual > 0;
}

/** The character whose first name appears first in the note, e.g. "Mai & Bao (with Tiny Ant)" → Mai. */
export function leadCharacterFor<T extends { name: string; code: string }>(note: string, characters: T[]): T | undefined {
  const lower = note.toLowerCase();
  let best: { character: T; index: number } | undefined;
  for (const character of characters) {
    if (character.code.endsWith('b')) continue; // alternate art of the same character
    const firstName = character.name.split(' ')[0]!.toLowerCase();
    const index = lower.search(new RegExp(`\\b${firstName}\\b`));
    if (index >= 0 && (!best || index < best.index)) best = { character, index };
  }
  return best?.character;
}

/**
 * Importing over reviewed content (only possible with --force) must not change it in place:
 * it becomes a new draft, like any other edit. Drafts keep their version.
 */
function reopen(existing: VersionedState | undefined | null): Partial<VersionedState> {
  return existing && existing.status !== 'DRAFT' ? stateAfterEdit(existing) : {};
}

function snapshot(row: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(row)) as Prisma.InputJsonValue;
}

/** The unit's materials: the Master Sheet materials plus deliverables only listed on the production tab (kept as OTHER). */
export function materialRowsFor(sheet: ParsedUnit['sheet']): ParsedUnit['sheet']['materials'] {
  const rows = [...sheet.materials];
  for (const [code, label] of sheet.productionLabels) {
    if (!rows.some((material) => material.code === code)) {
      rows.push({
        code,
        type: materialTypeForCode(code) === 'OTHER' ? 'OTHER' : materialTypeForCode(code),
        typeLabel: 'Deliverable',
        title: label,
        format: '',
        targetLanguage: '',
        fullText: '',
        actions: '',
        teacherNotes: '',
      });
    }
  }
  return rows;
}

/** Write one parsed unit. Re-running with the same input leaves the same rows (natural keys are upserted). */
export async function writeUnit(prisma: PrismaClient, parsed: ParsedUnit): Promise<WriteResult> {
  const { sheet, plans, pages } = parsed;
  const overview = sheet.overview;
  const program = await prisma.program.findUniqueOrThrow({ where: { code: 'LA' } });
  const level = await prisma.level.findUniqueOrThrow({
    where: { programId_number: { programId: program.id, number: overview.levelNumber } },
  });
  const characters = await prisma.character.findMany();
  const leadCharacter = leadCharacterFor(overview.leadCharacterNote, characters);

  return prisma.$transaction(
    async (tx) => {
      const unitData = {
        levelId: level.id,
        number: overview.number,
        title: overview.title,
        leadCharacterId: leadCharacter?.id ?? null,
        leadCharacterNote: overview.leadCharacterNote,
        circle: overview.circle,
        vnLink: overview.vnLink,
        bigQuestion: overview.bigQuestion,
        value: overview.value,
        party: overview.party,
        sounds: overview.sounds.map((sound) => sound.sound).join('; '),
        soundDetails: overview.sounds,
        keyLanguage: overview.keyLanguage,
        parentMessage: plans.parentMessage,
        levelRulesNote: overview.levelRulesNote,
        links: sheet.links as unknown as Prisma.InputJsonValue,
      };
      const existingUnit = await tx.unit.findUnique({ where: { code: overview.code } });
      const unit = await tx.unit.upsert({
        where: { code: overview.code },
        update: { ...unitData, ...reopen(existingUnit) },
        create: { code: overview.code, ...unitData },
      });
      const revisions: Prisma.RevisionCreateManyInput[] = [
        { entityType: 'unit', entityId: unit.id, version: unit.version, snapshot: snapshot(unit), note: IMPORT_NOTE },
      ];

      const [existingWords, existingMaterials, existingLessons] = await Promise.all([
        tx.word.findMany({ where: { unitId: unit.id } }).then((rows) => new Map(rows.map((row) => [row.cardId, row]))),
        tx.material.findMany({ where: { unitId: unit.id } }).then((rows) => new Map(rows.map((row) => [row.code, row]))),
        tx.lesson.findMany({ where: { unitId: unit.id } }).then((rows) => new Map(rows.map((row) => [row.number, row]))),
      ]);

      // Words
      const cardIds = sheet.words.map((word) => word.cardId);
      await tx.word.deleteMany({ where: { unitId: unit.id, cardId: { notIn: cardIds } } });
      for (const word of sheet.words) {
        const { cardId, ...data } = word;
        const row = await tx.word.upsert({
          where: { cardId },
          update: { ...data, unitId: unit.id, ...reopen(existingWords.get(cardId)) },
          create: { cardId, ...data, unitId: unit.id },
        });
        revisions.push({ entityType: 'word', entityId: row.id, version: row.version, snapshot: snapshot(row), note: IMPORT_NOTE });
      }

      const materialRows = materialRowsFor(sheet);
      const firstLesson = new Map<string, number>();
      for (const lesson of [...plans.lessons].sort((a, b) => a.number - b.number)) {
        for (const step of lesson.steps) {
          if (step.materialCode && !firstLesson.has(step.materialCode)) firstLesson.set(step.materialCode, lesson.number);
        }
      }
      // Lessons are rebuilt below, so steps referencing removed materials disappear with them.
      await tx.lesson.deleteMany({ where: { unitId: unit.id, number: { notIn: plans.lessons.map((l) => l.number) } } });
      await tx.lessonStep.deleteMany({ where: { lesson: { unitId: unit.id } } });
      await tx.prepItem.deleteMany({ where: { lesson: { unitId: unit.id } } });
      await tx.material.deleteMany({ where: { unitId: unit.id, code: { notIn: materialRows.map((m) => m.code) } } });

      const materialIds = new Map<string, string>();
      for (const material of materialRows) {
        const data = {
          type: material.type,
          title: material.title,
          format: material.format,
          targetLanguage: material.targetLanguage,
          fullText: material.fullText,
          actions: material.actions,
          teacherNotes: material.teacherNotes,
          firstLesson: firstLesson.get(material.code) ?? null,
        };
        const row = await tx.material.upsert({
          where: { unitId_code: { unitId: unit.id, code: material.code } },
          update: { ...data, ...reopen(existingMaterials.get(material.code)) },
          create: { ...data, unitId: unit.id, code: material.code },
        });
        materialIds.set(material.code, row.id);
        revisions.push({ entityType: 'material', entityId: row.id, version: row.version, snapshot: snapshot(row), note: IMPORT_NOTE });

        await tx.materialPage.deleteMany({ where: { materialId: row.id } });
        const materialPages = pages.get(material.code) ?? [];
        if (materialPages.length > 0) {
          await tx.materialPage.createMany({
            data: materialPages.map((page) => ({ materialId: row.id, number: page.number, text: page.text })),
          });
        }
      }

      // Production status
      for (const production of sheet.production) {
        const materialId = materialIds.get(production.code);
        if (!materialId) continue;
        for (const stage of ALL_STAGES) {
          const state = production.states[stage] ?? 'NOT_STARTED';
          await tx.productionStatus.upsert({
            where: { materialId_stage: { materialId, stage } },
            update: { state, owner: production.owner, dueDate: production.dueDate, notes: production.notes },
            create: { materialId, stage, state, owner: production.owner, dueDate: production.dueDate, notes: production.notes },
          });
        }
      }

      // Lessons, steps and prep
      const prepByLesson = new Map(sheet.prep.map((row) => [row.lesson, row]));
      for (const lesson of plans.lessons) {
        const prep = prepByLesson.get(lesson.number);
        const data = {
          week: lesson.week,
          stage: lesson.stage,
          minutes: lesson.minutes,
          newToday: lesson.newToday,
          goals: lesson.goals,
          keyLanguage: lesson.keyLanguage,
          support: lesson.support,
          challenge: lesson.challenge,
          lookFor: lesson.lookFor,
          homeLink: lesson.homeLink,
          prepMinutes: lesson.prepMinutes ?? prep?.prepMinutes ?? null,
          notes: prep?.notes ?? '',
        };
        const row = await tx.lesson.upsert({
          where: { unitId_number: { unitId: unit.id, number: lesson.number } },
          update: { ...data, ...reopen(existingLessons.get(lesson.number)) },
          create: { ...data, unitId: unit.id, number: lesson.number },
        });
        revisions.push({ entityType: 'lesson', entityId: row.id, version: row.version, snapshot: snapshot({ ...row, steps: lesson.steps }), note: IMPORT_NOTE });
        await tx.lessonStep.createMany({
          data: lesson.steps.map((step, index) => ({
            lessonId: row.id,
            order: index + 1,
            minutes: step.minutes,
            kind: step.kind,
            title: step.title,
            materialId: step.materialCode ? (materialIds.get(step.materialCode) ?? null) : null,
            teacherText: step.teacherText,
            childrenText: step.childrenText,
          })),
        });
        const prepItems = lesson.prepare.length > 0 ? lesson.prepare : (prep?.items ?? []);
        await tx.prepItem.createMany({
          data: prepItems.map((text, index) => {
            const code = /^([A-Z]{2}\d+)\b/.exec(text)?.[1];
            return { lessonId: row.id, order: index + 1, text, materialId: code ? (materialIds.get(code) ?? null) : null };
          }),
        });
      }

      // Can-do goals and gate checks
      await tx.canDoGoal.deleteMany({ where: { unitId: unit.id } });
      await tx.canDoGoal.createMany({
        data: overview.canDoGoals.map((text, index) => ({ unitId: unit.id, order: index + 1, text })),
      });
      // Keep sign-offs made in Admin when the same check is imported again.
      const signed = new Map(
        (await tx.gateCheck.findMany({ where: { unitId: unit.id, done: true } })).map((gate) => [`${gate.gate}:${gate.text}`, gate]),
      );
      await tx.gateCheck.deleteMany({ where: { unitId: unit.id } });
      await tx.gateCheck.createMany({
        data: sheet.gates.map((gate) => {
          const previous = signed.get(`${gate.gate}:${gate.text}`);
          return previous
            ? { ...gate, unitId: unit.id, done: true, doneAt: previous.doneAt, signer: previous.signer, notes: previous.notes || gate.notes }
            : { ...gate, unitId: unit.id };
        }),
      });

      await tx.revision.createMany({ data: revisions });

      return {
        unitId: unit.id,
        counts: {
          words: sheet.words.length,
          materials: materialRows.length,
          pages: [...pages.values()].reduce((sum, list) => sum + list.length, 0),
          lessons: plans.lessons.length,
          steps: plans.lessons.reduce((sum, lesson) => sum + lesson.steps.length, 0),
          canDoGoals: overview.canDoGoals.length,
          gateChecks: sheet.gates.length,
        },
      };
    },
    { timeout: 120_000, maxWait: 10_000 },
  );
}
