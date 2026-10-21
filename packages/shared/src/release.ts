/**
 * Published unit bundle. Admin builds it when a reviewer publishes a unit;
 * the Teacher app downloads it (and its media) for offline teaching.
 */

export const RELEASE_FORMAT = 1;

export type MediaKind = 'IMAGE' | 'AUDIO' | 'VIDEO' | 'PDF';

export interface ReleaseMedia {
  id: string;
  kind: MediaKind;
  mimeType: string;
  url: string;
  sizeBytes: number;
  fileName: string;
}

export interface ReleasePage {
  number: number;
  text: string;
  image: ReleaseMedia | null;
  audio: ReleaseMedia | null;
}

export interface ReleaseMaterial {
  code: string;
  type: string;
  title: string;
  format: string;
  targetLanguage: string;
  fullText: string;
  actions: string;
  teacherNotes: string;
  pages: ReleasePage[];
  /** Material-level files, e.g. role "poster", "audio", "draft-layout". */
  media: (ReleaseMedia & { role: string })[];
}

export interface ReleaseStep {
  order: number;
  minutes: number;
  kind: string;
  title: string;
  materialCode: string | null;
  teacherText: string;
  childrenText: string;
}

export interface ReleaseLesson {
  number: number;
  week: number;
  stage: string;
  minutes: number;
  newToday: string[];
  goals: string[];
  keyLanguage: string;
  prepMinutes: number | null;
  prep: { text: string; materialCode: string | null }[];
  steps: ReleaseStep[];
  support: string;
  challenge: string;
  lookFor: string;
  homeLink: string;
}

export interface ReleaseWord {
  cardId: string;
  text: string;
  kind: string;
  group: string;
  image: ReleaseMedia | null;
}

export interface UnitReleasePayload {
  format: typeof RELEASE_FORMAT;
  version: number;
  publishedAt: string;
  unit: {
    code: string;
    number: number;
    title: string;
    level: { number: number; name: string; ageBand: string; lessonMinutes: string };
    leadCharacter: { code: string; name: string; image: ReleaseMedia | null } | null;
    bigQuestion: string;
    value: string;
    party: string;
    sounds: { sound: string; words: string }[];
    keyLanguage: string[];
    parentMessage: string;
  };
  canDoGoals: { order: number; text: string }[];
  words: ReleaseWord[];
  materials: ReleaseMaterial[];
  lessons: ReleaseLesson[];
}

/** Every media file a release needs, without duplicates (for offline download). */
export function releaseMedia(payload: UnitReleasePayload): ReleaseMedia[] {
  const byId = new Map<string, ReleaseMedia>();
  const add = (media: ReleaseMedia | null): void => {
    if (media) byId.set(media.id, media);
  };
  add(payload.unit.leadCharacter?.image ?? null);
  for (const word of payload.words) add(word.image);
  for (const material of payload.materials) {
    material.media.forEach(add);
    for (const page of material.pages) {
      add(page.image);
      add(page.audio);
    }
  }
  return [...byId.values()];
}
