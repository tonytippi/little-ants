import { describe, expect, it } from 'vitest';
import { listeningItemKey, listeningMedia, listeningPayload, nextOpenLeaf, weekStart } from '../src/index.js';
import type { UnitReleasePayload } from '../src/index.js';

const media = (id: string, kind: 'IMAGE' | 'AUDIO' | 'PDF') => ({
  id,
  kind,
  mimeType: 'x',
  url: `https://media/${id}`,
  sizeBytes: 1,
  fileName: id,
});

const release = {
  format: 1,
  version: 3,
  publishedAt: '2026-10-28T00:00:00.000Z',
  unit: {
    code: 'U05',
    number: 5,
    title: 'Yummy Garden',
    level: { number: 2, name: 'Busy Ants', ageBand: '4–5', lessonMinutes: '30' },
    leadCharacter: { code: 'GRANDMA', name: 'Grandma Ant', image: media('lead', 'IMAGE') },
    bigQuestion: '',
    value: '',
    party: '',
    sounds: [{ sound: 'a /æ/', words: 'ant, apple' }],
    keyLanguage: [],
    parentMessage: '',
    cover: media('cover', 'IMAGE'),
  },
  canDoGoals: [],
  words: [
    { cardId: 'U05-01', text: 'apple', kind: 'CORE', group: 'fruit', image: media('apple', 'IMAGE') },
    { cardId: 'U05-02', text: 'banana', kind: 'CORE', group: 'fruit', image: null },
  ],
  materials: [
    {
      code: 'SG1',
      type: 'SONG',
      title: 'In Our Yummy Garden',
      format: '',
      targetLanguage: '',
      fullText: 'This is the way…',
      actions: '',
      teacherNotes: 'secret',
      pages: [],
      media: [
        { ...media('song', 'AUDIO'), role: 'audio' },
        { ...media('layout', 'PDF'), role: 'draft-layout' },
      ],
    },
    {
      code: 'LP1',
      type: 'LESSON_PLAN',
      title: 'Plan',
      format: '',
      targetLanguage: '',
      fullText: '',
      actions: '',
      teacherNotes: '',
      pages: [],
      media: [],
    },
  ],
  lessons: [],
  listening: {
    bridge: null,
    leaves: [
      {
        number: 1,
        stage: 'LOOK_BACK_AND_MEET',
        minutes: 3,
        items: [
          { kind: 'material', code: 'SG1', type: 'SONG', title: 'In Our Yummy Garden', seconds: 78 },
          { kind: 'words', title: 'Fruit', cards: [{ cardId: 'U05-01', text: 'apple' }], seconds: 60 },
        ],
      },
    ],
  },
} as unknown as UnitReleasePayload;

describe('listening payload', () => {
  it('keeps what leaves play and leaves out staff material', () => {
    const payload = listeningPayload(release)!;
    expect(payload.materials.map((material) => material.code)).toEqual(['SG1']);
    expect(payload.materials[0]!.media.map((item) => item.id)).toEqual(['song']);
    expect(JSON.stringify(payload)).not.toContain('secret');
    expect(payload.words.map((word) => word.cardId)).toEqual(['U05-01']);
    expect(
      listeningMedia(payload)
        .map((item) => item.id)
        .sort(),
    ).toEqual(['apple', 'cover', 'lead', 'song']);
  });

  it('is null for releases from before Listening Time', () => {
    expect(listeningPayload({ ...release, listening: undefined })).toBeNull();
  });

  it('keys items for "times heard"', () => {
    const [song, words] = release.listening!.leaves[0]!.items;
    expect(listeningItemKey(song!)).toBe('SG1');
    expect(listeningItemKey(words!)).toBe('WC:U05-01');
  });
});

describe('leaf order and weeks', () => {
  it('opens the first unfinished leaf', () => {
    expect(nextOpenLeaf([])).toBe(1);
    expect(nextOpenLeaf([1, 2, 4])).toBe(3);
    expect(nextOpenLeaf(Array.from({ length: 40 }, (_, index) => index + 1))).toBe(40);
  });

  it('starts weeks on Monday', () => {
    expect(weekStart('2026-10-28')).toBe('2026-10-26'); // Wednesday
    expect(weekStart('2026-10-26')).toBe('2026-10-26'); // Monday
    expect(weekStart('2026-11-01')).toBe('2026-10-26'); // Sunday
  });
});
