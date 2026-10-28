import { z } from 'zod';
import {
  LISTENING_LEAF_COUNT,
  type ListeningBridge,
  type ListeningItem,
  type ListeningLeaf,
} from './listening-plan.js';
import type { ReleaseMedia, ReleasePage, UnitReleasePayload } from './release.js';

/** At home, a child opens at most this many new leaves a day (repeats are always fine). */
export const NEW_LEAVES_PER_DAY = 2;
/** The weekly home goal: listening on this many days. */
export const DAYS_PER_WEEK_GOAL = 4;

/**
 * What the student app needs to play a unit's leaves: no lesson plans, teacher notes or print files.
 * Built from a release, so it only ever holds approved, public media.
 */
export interface ListeningPayload {
  version: number;
  publishedAt: string;
  unit: {
    code: string;
    number: number;
    title: string;
    level: { number: number; name: string };
    leadCharacter: { name: string; image: ReleaseMedia | null } | null;
    cover: ReleaseMedia | null;
    sounds: { sound: string; words: string }[];
  };
  leaves: ListeningLeaf[];
  bridge: ListeningBridge | null;
  /** The unit's materials that leaves play, with their pictures, recordings and words. */
  materials: {
    code: string;
    type: string;
    title: string;
    fullText: string;
    actions: string;
    pages: ReleasePage[];
    media: (ReleaseMedia & { role: string })[];
  }[];
  words: { cardId: string; text: string; image: ReleaseMedia | null }[];
}

/** The listening part of a release, or null for releases published before leaves existed. */
export function listeningPayload(release: UnitReleasePayload): ListeningPayload | null {
  if (!release.listening) return null;
  const { leaves, bridge } = release.listening;
  const codes = new Set<string>();
  const cardIds = new Set<string>();
  for (const leaf of leaves)
    for (const item of leaf.items) {
      if (item.kind === 'material' || item.kind === 'sound') codes.add(item.code);
      if (item.kind === 'words') for (const card of item.cards) cardIds.add(card.cardId);
    }
  const { unit } = release;
  return {
    version: release.version,
    publishedAt: release.publishedAt,
    unit: {
      code: unit.code,
      number: unit.number,
      title: unit.title,
      level: { number: unit.level.number, name: unit.level.name },
      leadCharacter: unit.leadCharacter
        ? { name: unit.leadCharacter.name, image: unit.leadCharacter.image }
        : null,
      cover: unit.cover ?? null,
      sounds: unit.sounds,
    },
    leaves,
    bridge,
    materials: release.materials
      .filter((material) => codes.has(material.code))
      .map((material) => ({
        code: material.code,
        type: material.type,
        title: material.title,
        fullText: material.fullText,
        actions: material.actions,
        pages: material.pages,
        // Pictures and recordings only: draft layouts and print PDFs are for staff.
        media: material.media.filter((media) => media.kind === 'IMAGE' || media.kind === 'AUDIO'),
      })),
    words: release.words
      .filter((word) => cardIds.has(word.cardId))
      .map((word) => ({ cardId: word.cardId, text: word.text, image: word.image })),
  };
}

/** Every file a listening payload plays, without duplicates (for offline download). */
export function listeningMedia(payload: ListeningPayload): ReleaseMedia[] {
  const byId = new Map<string, ReleaseMedia>();
  const add = (media: ReleaseMedia | null | undefined): void => {
    if (media) byId.set(media.id, media);
  };
  add(payload.unit.cover);
  add(payload.unit.leadCharacter?.image);
  add(payload.bridge?.audio);
  for (const leaf of payload.leaves)
    for (const item of leaf.items) if (item.kind === 'lookBack') add(item.audio);
  for (const material of payload.materials) {
    material.media.forEach(add);
    for (const page of material.pages) {
      add(page.image);
      add(page.audio);
    }
  }
  for (const word of payload.words) add(word.image);
  return [...byId.values()];
}

/** A stable key per item, for counting "times heard". */
export function listeningItemKey(item: ListeningItem): string {
  switch (item.kind) {
    case 'material':
      return item.code;
    case 'sound':
      return `SN:${item.sound}`;
    case 'words':
      return `WC:${item.cards.map((card) => card.cardId).join(',')}`;
    case 'lookBack':
      return `${item.unitCode}:${item.materialCode}`;
  }
}

/** The next leaf to open at home: the first one not finished yet (the last leaf once all are done). */
export function nextOpenLeaf(completed: Iterable<number>): number {
  const done = new Set(completed);
  for (let leaf = 1; leaf <= LISTENING_LEAF_COUNT; leaf += 1) if (!done.has(leaf)) return leaf;
  return LISTENING_LEAF_COUNT;
}

/** Monday of the week a local date (YYYY-MM-DD) falls in, as YYYY-MM-DD. */
export function weekStart(day: string): string {
  const date = new Date(`${day}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

/** A real calendar date as YYYY-MM-DD (2026-02-30 is refused). */
export const localDateSchema = z.iso.date();

/** Leaves finished at home, uploaded from the device (possibly days later). */
export const listeningSyncInput = z.object({
  logs: z
    .array(
      z.object({
        clientId: z.string().uuid(),
        unitCode: z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^U\d{2}$/),
        leaf: z.number().int().min(1).max(LISTENING_LEAF_COUNT),
        playedOn: localDateSchema,
        completedAt: z.coerce.date(),
        itemsHeard: z.array(z.string().max(200)).max(50).default([]),
      }),
    )
    .max(200),
});
export type ListeningSyncInput = z.infer<typeof listeningSyncInput>;

/** A child's listening for one unit and their recent weeks. */
export interface ListeningSummary {
  unitCode: string;
  /** Leaves finished at least once. */
  completed: number[];
  nextLeaf: number;
  /** New leaves opened on `today` (the device's date sent with the request). */
  newToday: number;
  /** Days with listening per week (Monday dates), newest first, all units. */
  weeks: { weekStart: string; days: number }[];
  /** Times each item was heard, by `listeningItemKey`. */
  heard: Record<string, number>;
}
