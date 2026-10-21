import type { LessonStage, MaterialType, ProductionState, StepKind, WordKind } from '@little-ants/db';

const MATERIAL_PREFIXES: Record<string, MaterialType> = {
  RT: 'ROUTINE',
  SG: 'SONG',
  CH: 'CHANT',
  RH: 'RHYME',
  ST: 'STORY',
  BB: 'BOOK',
  MD: 'MOVE_AND_DO',
  TS: 'TALK_SCENE',
  SN: 'SOUND_TRAIL',
  TT: 'TINY_TRACKS',
  HH: 'HOME_HILL',
};

/** Material codes look like SG1, ST12, RT3 or the single-item codes SN, TT, HH. */
export const MATERIAL_CODE = /^(?:(?:RT|SG|CH|RH|ST|BB|MD|TS)\d+|SN|TT|HH)$/;
const MATERIAL_CODE_IN_TEXT = /\b(?:RT|SG|CH|RH|ST|BB|MD|TS)\d+\b/g;

export function materialTypeForCode(code: string): MaterialType {
  return MATERIAL_PREFIXES[code.slice(0, 2)] ?? 'OTHER';
}

export function isMaterialCode(value: string): boolean {
  return MATERIAL_CODE.test(value);
}

/** Every material code mentioned in a piece of text, in order, without duplicates. */
export function materialCodesIn(text: string): string[] {
  return [...new Set(text.match(MATERIAL_CODE_IN_TEXT) ?? [])];
}

export function wordKind(label: string): WordKind {
  const value = label.trim().toLowerCase();
  if (value.startsWith('extra')) return 'EXTRA';
  if (value.startsWith('review')) return 'REVIEW';
  return 'CORE';
}

export function lessonStage(label: string): LessonStage | null {
  const value = label.trim().toLowerCase();
  if (value.startsWith('hear it')) return 'HEAR_IT';
  if (value.startsWith('join in')) return 'JOIN_IN';
  if (value.startsWith('say it myself')) return 'SAY_IT_MYSELF';
  if (value.includes('party')) return 'PARTY';
  if (value.startsWith('show & share') || value.startsWith('show and share')) return 'SHOW_AND_SHARE';
  return null;
}

export function productionState(label: string): ProductionState | null {
  const value = label.trim().toLowerCase();
  if (!value) return null;
  if (value === 'done') return 'DONE';
  if (value === 'not started') return 'NOT_STARTED';
  if (value === 'in progress') return 'IN_PROGRESS';
  if (value === 'review') return 'REVIEW';
  if (value === 'n/a' || value === 'na') return 'NOT_APPLICABLE';
  return null;
}

/** Step kind and linked material for a lesson flow row title such as "CH2 I Can Jump!" or "Sound Trail: m /m/". */
export function classifyStep(title: string): { kind: StepKind; materialCode: string | null } {
  // "NEW song: SG1 Hello, What's Your Name?" → "SG1 Hello, What's Your Name?"
  const bare = title.trim().replace(/^NEW\b[^:]*:\s*/i, '');
  const code = /^([A-Z]{2}\d+)\b/.exec(bare)?.[1] ?? null;
  if (code && isMaterialCode(code)) {
    const byType: Partial<Record<MaterialType, StepKind>> = {
      ROUTINE: 'SONG',
      SONG: 'SONG',
      CHANT: 'CHANT',
      RHYME: 'RHYME',
      STORY: 'STORY',
      BOOK: 'BOOK',
      MOVE_AND_DO: 'MOVE_AND_DO',
      TALK_SCENE: 'TALK_SCENE',
    };
    return { kind: byType[materialTypeForCode(code)] ?? 'OTHER', materialCode: code };
  }
  const value = bare.toLowerCase();
  if (value.startsWith('hello circle')) return { kind: 'HELLO_CIRCLE', materialCode: null };
  // The Talk Scene is named by title ("Talk Scene: Ant Hill School"); parse-unit links it by title.
  if (value.startsWith('talk scene')) return { kind: 'TALK_SCENE', materialCode: null };
  if (value.startsWith('sound trail')) return { kind: 'SOUND_TRAIL', materialCode: 'SN' };
  if (value.startsWith('ant wiggle')) return { kind: 'ANT_WIGGLE', materialCode: null };
  if (value.startsWith('tiny tracks')) return { kind: 'TINY_TRACKS', materialCode: 'TT' };
  if (value.startsWith('checkpoint')) return { kind: 'CHECKPOINT', materialCode: null };
  if (value.startsWith('show & share') || value.startsWith('show and share')) {
    return { kind: 'SHOW_AND_SHARE', materialCode: null };
  }
  if (value.includes('party')) return { kind: 'PARTY', materialCode: null };
  if (value.startsWith('goodbye')) return { kind: 'GOODBYE', materialCode: null };
  return { kind: 'OTHER', materialCode: null };
}

/** "3'" or "3 min" → 3 */
export function parseMinutes(value: string): number | null {
  const match = /(\d+)/.exec(value);
  return match ? Number(match[1]) : null;
}

export function splitList(value: string): string[] {
  return value
    .split(/[,;+]/)
    .map((part) => part.trim())
    .filter((part) => part && part !== '—' && part !== '-');
}
