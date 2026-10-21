import { z } from 'zod';

export const CONTENT_STATUSES = ['DRAFT', 'REVIEW', 'APPROVED', 'ARCHIVED'] as const;
export const contentStatus = z.enum(CONTENT_STATUSES);

export const MATERIAL_TYPES = [
  'ROUTINE',
  'SONG',
  'CHANT',
  'RHYME',
  'STORY',
  'BOOK',
  'MOVE_AND_DO',
  'TALK_SCENE',
  'SOUND_TRAIL',
  'TINY_TRACKS',
  'HOME_HILL',
  'OTHER',
] as const;

export const STEP_KINDS = [
  'HELLO_CIRCLE',
  'SONG',
  'CHANT',
  'SOUND_TRAIL',
  'RHYME',
  'ANT_WIGGLE',
  'STORY',
  'BOOK',
  'MOVE_AND_DO',
  'TALK_SCENE',
  'TINY_TRACKS',
  'CHECKPOINT',
  'SHOW_AND_SHARE',
  'PARTY',
  'GOODBYE',
  'OTHER',
] as const;

export const LESSON_STAGES = ['HEAR_IT', 'JOIN_IN', 'SAY_IT_MYSELF', 'PARTY', 'SHOW_AND_SHARE'] as const;
export const PRODUCTION_STAGES = [
  'TEXT',
  'ENGLISH_CHECK',
  'ILLUSTRATION',
  'LAYOUT',
  'AUDIO_VIDEO',
  'TEACHER_TEST',
  'PRINT_READY',
] as const;
export const PRODUCTION_STATES = ['NOT_STARTED', 'IN_PROGRESS', 'REVIEW', 'DONE', 'NOT_APPLICABLE'] as const;

const text = (max = 5000) => z.string().max(max);
const id = z.string().min(1);

export const statusChange = z.object({ status: contentStatus, note: text(500).optional() });

export const unitUpdate = z
  .object({
    title: text(200).min(1),
    leadCharacterId: id.nullable(),
    leadCharacterNote: text(300),
    circle: text(200),
    vnLink: text(300),
    bigQuestion: text(300),
    value: text(300),
    party: text(1000),
    sounds: text(300),
    keyLanguage: z.array(text(300)).max(20),
    parentMessage: text(3000),
    levelRulesNote: text(500),
    links: z.array(z.object({ what: text(300), fromUnit: text(50), how: text(1000), where: text(100) })).max(30),
  })
  .partial()
  .extend({ note: text(500).optional() });

const wordBase = z.object({
  cardId: z.string().regex(/^U\d{2}-[A-Z0-9]+$/, 'Use the form U01-41'),
  text: text(100).min(1),
  partOfSpeech: text(50),
  kind: z.enum(['CORE', 'EXTRA', 'REVIEW']),
  group: text(100),
  fromUnit: text(20),
  pictureBrief: text(500),
  notes: text(500),
  imageAssetId: id.nullable(),
});
export const wordInput = wordBase.extend({
  partOfSpeech: wordBase.shape.partOfSpeech.default(''),
  kind: wordBase.shape.kind.default('CORE'),
  group: wordBase.shape.group.default(''),
  fromUnit: wordBase.shape.fromUnit.default(''),
  pictureBrief: wordBase.shape.pictureBrief.default(''),
  notes: wordBase.shape.notes.default(''),
  imageAssetId: wordBase.shape.imageAssetId.default(null),
});
// No defaults here: a PATCH changes only the fields it sends.
export const wordUpdate = wordBase.partial().extend({ order: z.number().int().min(1).optional(), note: text(500).optional() });

export const materialUpdate = z
  .object({
    type: z.enum(MATERIAL_TYPES),
    title: text(200).min(1),
    format: text(300),
    targetLanguage: text(1000),
    fullText: text(20000),
    actions: text(2000),
    teacherNotes: text(2000),
    firstLesson: z.number().int().min(1).max(40).nullable(),
  })
  .partial()
  .extend({ note: text(500).optional() });

export const materialInput = z.object({
  code: z.string().regex(/^[A-Z]{2,5}\d*$/, 'Use a code such as SG4 or ST3'),
  type: z.enum(MATERIAL_TYPES),
  title: text(200).min(1),
});

export const pagesInput = z.object({
  pages: z
    .array(
      z.object({
        text: text(2000),
        imageAssetId: id.nullable().default(null),
        audioAssetId: id.nullable().default(null),
      }),
    )
    .max(60),
  note: text(500).optional(),
});

export const materialAssetsInput = z.object({
  role: z.string().regex(/^[a-z-]{2,30}$/),
  assetIds: z.array(id).max(30),
});

export const lessonInput = z.object({
  week: z.number().int().min(1).max(12),
  stage: z.enum(LESSON_STAGES),
  minutes: z.number().int().min(5).max(90),
  newToday: z.array(z.string().max(10)).max(20),
  goals: z.array(text(500)).max(10),
  keyLanguage: text(2000),
  support: text(2000),
  challenge: text(2000),
  lookFor: text(2000),
  homeLink: text(2000),
  prepMinutes: z.number().int().min(0).max(240).nullable(),
  notes: text(2000),
  steps: z
    .array(
      z.object({
        minutes: z.number().int().min(0).max(60),
        kind: z.enum(STEP_KINDS),
        title: text(300).min(1),
        materialId: id.nullable(),
        teacherText: text(5000),
        childrenText: text(2000),
      }),
    )
    .max(30),
  prep: z.array(z.object({ text: text(500).min(1), materialId: id.nullable() })).max(40),
  note: text(500).optional(),
});

export const canDoGoalsInput = z.object({ goals: z.array(text(500).min(1)).max(15) });

export const gateCheckUpdate = z.object({ done: z.boolean().optional(), notes: text(1000).optional(), signer: text(100).optional() });

export const productionUpdate = z.object({
  state: z.enum(PRODUCTION_STATES).optional(),
  owner: text(100).optional(),
  dueDate: z.coerce.date().nullable().optional(),
  notes: text(1000).optional(),
});

export const ASSET_MIME_TYPES: Record<string, 'IMAGE' | 'AUDIO' | 'VIDEO' | 'PDF'> = {
  'image/png': 'IMAGE',
  'image/jpeg': 'IMAGE',
  'image/webp': 'IMAGE',
  'audio/mpeg': 'AUDIO',
  'audio/mp4': 'AUDIO',
  'audio/aac': 'AUDIO',
  'audio/wav': 'AUDIO',
  'video/mp4': 'VIDEO',
  'application/pdf': 'PDF',
};

export const MAX_ASSET_BYTES = 200 * 1024 * 1024;

export const uploadRequest = z.object({
  fileName: text(200).min(1),
  mimeType: z.string().refine((value) => value in ASSET_MIME_TYPES, 'File type not allowed'),
  sizeBytes: z.number().int().min(1).max(MAX_ASSET_BYTES),
  /** Upload a new version of this asset. */
  replacesId: id.optional(),
});

export const releaseInput = z.object({ note: text(500).default('') });

export const lessonRunInput = z.object({
  clientId: z.string().uuid(),
  classId: id,
  unitCode: z.string().regex(/^U\d{2}$/),
  lessonNumber: z.number().int().min(1).max(40),
  releaseVersion: z.number().int().min(1),
  taughtAt: z.coerce.date(),
  notes: text(3000).default(''),
});

export const observationInput = z.object({
  clientId: z.string().uuid(),
  studentId: id,
  classId: id,
  unitCode: z.string().regex(/^U\d{2}$/),
  goalOrder: z.number().int().min(1).max(15),
  level: z.enum(['NOT_YET', 'WITH_HELP', 'ON_MY_OWN']),
  lessonNumber: z.number().int().min(1).max(40).nullable().default(null),
  observedAt: z.coerce.date(),
});

/** Offline outbox upload: many records in one request. */
export const syncInput = z.object({
  lessonRuns: z.array(lessonRunInput).max(200).default([]),
  observations: z.array(observationInput).max(2000).default([]),
});
export type SyncInput = z.infer<typeof syncInput>;
