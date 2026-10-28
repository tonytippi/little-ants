import { describe, expect, it } from 'vitest';
import {
  buildListeningPlan,
  LISTENING_ESTIMATED_SECONDS,
  listeningHomeMinutes,
  type ListeningBridge,
  type ListeningItem,
  type ListeningLeaf,
  type ListeningSource,
} from '../src/listening-plan.js';
import { releaseMedia, type ReleaseMedia, type UnitReleasePayload } from '../src/release.js';

// A Unit 5 ("Yummy Garden") like unit: materials, the lesson each is first taught in and the audio
// lengths of the Listening Time prototype.
const MATERIALS: { code: string; type: string; title: string; first: number; seconds: number }[] = [
  { code: 'RT1', type: 'ROUTINE', title: 'Hello Song', first: 1, seconds: 60 },
  { code: 'SG1', type: 'SONG', title: 'In Our Yummy Garden', first: 1, seconds: 78 },
  { code: 'SG2', type: 'SONG', title: 'Do You Like Fruits?', first: 6, seconds: 40 },
  { code: 'SG3', type: 'SONG', title: 'Five Red Apples', first: 16, seconds: 61 },
  { code: 'CH1', type: 'CHANT', title: 'Crunch, Munch, Yum!', first: 4, seconds: 33 },
  { code: 'CH2', type: 'CHANT', title: 'Can I Have a Mango, Please?', first: 11, seconds: 30 },
  { code: 'RH1', type: 'RHYME', title: 'Apple, Apple', first: 1, seconds: 40 },
  { code: 'RH2', type: 'RHYME', title: 'Peas in a Pod', first: 6, seconds: 30 },
  { code: 'RH3', type: 'RHYME', title: 'Watermelon', first: 16, seconds: 40 },
  { code: 'ST1', type: 'STORY', title: "Annie's Big Basket", first: 1, seconds: 150 },
  { code: 'ST2', type: 'STORY', title: 'Just One Taste', first: 11, seconds: 160 },
  { code: 'ST3', type: 'STORY', title: 'At the Fruit Market', first: 19, seconds: 160 },
  { code: 'BB1', type: 'BOOK', title: "What's in the Garden?", first: 3, seconds: 90 },
  { code: 'BB2', type: 'BOOK', title: 'Grow, Little Seed', first: 13, seconds: 80 },
  { code: 'MD1', type: 'MOVE_AND_DO', title: 'Fruit Salad Shake', first: 1, seconds: 75 },
  { code: 'MD2', type: 'MOVE_AND_DO', title: 'Little Seeds, Grow!', first: 8, seconds: 80 },
  { code: 'MD3', type: 'MOVE_AND_DO', title: 'Fruit Basket Switch', first: 18, seconds: 70 },
  { code: 'TS1', type: 'TALK_SCENE', title: "Grandma's Yummy Garden", first: 7, seconds: 60 },
  { code: 'SN', type: 'SOUND_TRAIL', title: 'Sound Trails', first: 1, seconds: 25 },
  { code: 'TT', type: 'TINY_TRACKS', title: 'Tiny Tracks', first: 2, seconds: 0 },
  // Never used in a lesson: must never play.
  { code: 'CH9', type: 'CHANT', title: 'Unused chant', first: Infinity, seconds: 30 },
];
const SOUNDS = [
  { sound: 'a  /æ/', first: 1, words: 'ant, apple' },
  { sound: 'p  /p/', first: 6, words: 'pear, peas, pumpkin' },
  { sound: 'w  /w/', first: 16, words: 'watermelon, water, wow' },
];
const RHYME_OF_SOUND: Record<string, string> = { 'a /æ/': 'RH1', 'p /p/': 'RH2', 'w /w/': 'RH3' };
const WORDS = [
  'apple', 'banana', 'orange', 'mango', 'watermelon', 'pineapple', 'pear', 'dragon fruit', 'carrot', 'tomato',
  'corn', 'peas', 'pumpkin', 'lemon', 'fruit', 'vegetables', 'garden', 'market', 'seed', 'tree', 'basket',
  'bowl', 'soup', 'pick', 'wash', 'peel', 'cut', 'eat', 'plant', 'water', 'grow', 'share', 'taste', 'sweet',
  'sour', 'yummy', 'round', 'hungry', 'Here you are', 'smell',
]; // prettier-ignore
const groupOf = (index: number): string =>
  index < 8
    ? 'fruit'
    : index < 16
      ? 'vegetables'
      : index < 23
        ? 'places'
        : index < 33
          ? 'actions'
          : 'describing';
/** Lesson in which the word-card step first shows each block of six words. */
const WORD_BLOCK_LESSON = [1, 3, 6, 8, 11, 13, 16];
const DURATIONS = Object.fromEntries(MATERIALS.map((m) => [m.code, m.seconds]));
const FIRST = new Map(MATERIALS.map((m) => [m.code, m.first]));
const soundFirst = (label: string): number =>
  SOUNDS.find((s) => s.sound.replaceAll(/\s+/g, ' ') === label)?.first ?? Infinity;

/** A material is used in its first lesson and every third lesson after it. */
const usedIn = (first: number, lesson: number): boolean => lesson >= first && (lesson - first) % 3 === 0;

function unitSource(levelNumber = 2): ListeningSource {
  const lessons: ListeningSource['lessons'] = [];
  for (let number = 1; number <= 40; number += 1) {
    const steps: ListeningSource['lessons'][number]['steps'] = [];
    const block = WORD_BLOCK_LESSON.indexOf(number);
    if (block >= 0)
      steps.push({
        kind: 'OTHER',
        title: 'Word cards',
        materialCode: null,
        teacherText: `Show the cards: ${WORDS.slice(block * 6, block * 6 + 6).join(', ')}.`,
      });
    for (const m of MATERIALS) {
      if (m.code === 'SN' || m.code === 'CH9' || !usedIn(m.first, number)) continue;
      steps.push({ kind: m.type, title: `${m.code} ${m.title}`, materialCode: m.code });
    }
    for (const s of SOUNDS)
      if (usedIn(s.first, number))
        steps.push({ kind: 'SOUND_TRAIL', title: `Sound Trail: ${s.sound}`, materialCode: 'SN' });
    lessons.push({ number, keyLanguage: '', goals: [], steps });
  }
  return {
    unit: { level: { number: levelNumber }, sounds: SOUNDS.map(({ sound, words }) => ({ sound, words })) },
    words: WORDS.map((text, i) => ({
      cardId: `U05-${String(i + 1).padStart(2, '0')}`,
      text,
      group: groupOf(i),
    })),
    materials: MATERIALS.map(({ code, type, title }) => ({ code, type, title })),
    lessons,
  };
}

const audio = (id: string): ReleaseMedia => ({
  id,
  kind: 'AUDIO',
  mimeType: 'audio/mpeg',
  url: `https://media.example/${id}.mp3`,
  sizeBytes: 1,
  fileName: `${id}.mp3`,
});
const BRIDGE: ListeningBridge = {
  unitCode: 'U04',
  materialCode: 'SG1',
  title: 'Old MacDonald',
  audio: audio('u04-sg1'),
};
const FAVOURITES: ListeningBridge[] = [
  { unitCode: 'U04', materialCode: 'SG2', title: 'Farm Friends', audio: audio('u04-sg2') },
  { unitCode: 'U04', materialCode: 'CH1', title: 'Moo, Baa', audio: null },
];

const plan = buildListeningPlan(unitSource(), {
  bridge: BRIDGE,
  favourites: FAVOURITES,
  durations: DURATIONS,
});
const leaf = (n: number): ListeningLeaf => plan.leaves[n - 1]!;
const types = (item: ListeningItem): string =>
  item.kind === 'material' ? item.type : item.kind === 'sound' ? 'SOUND_TRAIL' : item.kind;
const ofType = (l: ListeningLeaf, ...wanted: string[]) =>
  l.items.filter((item) => wanted.includes(types(item)));
const codes = (l: ListeningLeaf): string[] =>
  l.items.flatMap((item) => (item.kind === 'material' ? [item.code] : []));
const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);
const firstOf = (item: ListeningItem): number => {
  if (item.kind === 'material') return FIRST.get(item.code)!;
  if (item.kind === 'sound') return soundFirst(item.sound);
  if (item.kind === 'words')
    return Math.max(
      ...item.cards.map((card) => WORD_BLOCK_LESSON[Math.floor(WORDS.indexOf(card.text) / 6)]!),
    );
  return 0;
};

describe('buildListeningPlan', () => {
  it('makes 40 numbered leaves in the four stages', () => {
    expect(plan.leaves.map((l) => l.number)).toEqual(range(1, 40));
    expect(plan.leaves.map((l) => l.stage)).toEqual([
      ...Array(8).fill('LOOK_BACK_AND_MEET'),
      ...Array(28).fill('LISTEN_AND_JOIN_IN'),
      'PARTY',
      'PARTY',
      'FAVOURITES',
      'FAVOURITES',
    ]);
    expect(plan.bridge).toEqual(BRIDGE);
  });

  it('is deterministic', () => {
    const again = buildListeningPlan(unitSource(), {
      bridge: BRIDGE,
      favourites: FAVOURITES,
      durations: DURATIONS,
    });
    expect(again).toEqual(plan);
  });

  it('plays only items taught on or before the leaf lesson', () => {
    for (const l of plan.leaves)
      for (const item of l.items) expect(firstOf(item), `leaf ${l.number}`).toBeLessThanOrEqual(l.number);
  });

  it('never plays routines, Tiny Tracks or materials no lesson uses', () => {
    const all = new Set(plan.leaves.flatMap(codes));
    for (const code of ['RT1', 'TT', 'CH9']) expect(all.has(code)).toBe(false);
  });

  it('starts leaves 1–5 with the bridge song and 6–8 with a favourite of the last unit', () => {
    for (const n of range(1, 5)) expect(leaf(n).items[0]).toMatchObject({ kind: 'lookBack', ...BRIDGE });
    expect(leaf(6).items[0]).toMatchObject({ kind: 'lookBack', materialCode: 'SG2' });
    expect(leaf(7).items[0]).toMatchObject({ kind: 'lookBack', materialCode: 'CH1' });
    expect(leaf(8).items[0]).toMatchObject({ kind: 'lookBack', materialCode: 'SG2' });
    for (const n of range(9, 40)) expect(ofType(leaf(n), 'lookBack')).toHaveLength(0);
  });

  it('uses the bridge song as the favourite when no other is known, and none for a first unit', () => {
    const bridgeOnly = buildListeningPlan(unitSource(), { bridge: BRIDGE, durations: DURATIONS });
    for (const n of range(6, 8)) expect(bridgeOnly.leaves[n - 1]!.items[0]).toMatchObject(BRIDGE);
    const firstUnit = buildListeningPlan(unitSource(), { bridge: null, durations: DURATIONS });
    expect(firstUnit.bridge).toBeNull();
    expect(firstUnit.leaves.flatMap((l) => ofType(l, 'lookBack'))).toHaveLength(0);
  });

  it('meets the new unit in leaves 1–8: word cards, a song, a sound + rhyme, a story or book, a Move & Do', () => {
    for (const n of range(1, 8)) {
      const l = leaf(n);
      expect(ofType(l, 'words'), `leaf ${n}`).toHaveLength(1);
      expect(ofType(l, 'SONG', 'CHANT').length, `leaf ${n}`).toBeGreaterThanOrEqual(1);
      expect(ofType(l, 'SOUND_TRAIL').length, `leaf ${n}`).toBeGreaterThanOrEqual(1);
      expect(ofType(l, 'RHYME').length, `leaf ${n}`).toBeGreaterThanOrEqual(1);
      expect(ofType(l, 'STORY', 'BOOK').length, `leaf ${n}`).toBeGreaterThanOrEqual(1);
      expect(ofType(l, 'MOVE_AND_DO').length, `leaf ${n}`).toBeGreaterThanOrEqual(1);
    }
  });

  it('fills leaves 9–36 with the Listen & join in mix', () => {
    for (const n of range(9, 36)) {
      const l = leaf(n);
      expect(ofType(l, 'words'), `leaf ${n}`).toHaveLength(1);
      expect(ofType(l, 'SONG', 'CHANT').length, `leaf ${n}`).toBeGreaterThanOrEqual(2);
      expect(ofType(l, 'SOUND_TRAIL').length, `leaf ${n}`).toBeGreaterThanOrEqual(1);
      expect(ofType(l, 'RHYME').length, `leaf ${n}`).toBeGreaterThanOrEqual(1);
      expect(ofType(l, 'STORY').length, `leaf ${n}`).toBeGreaterThanOrEqual(1);
      expect(ofType(l, 'MOVE_AND_DO').length, `leaf ${n}`).toBeGreaterThanOrEqual(1);
      if (n % 2 === 0) expect(ofType(l, 'BOOK').length, `book in leaf ${n}`).toBeGreaterThanOrEqual(1);
      if (n % 3 === 0) expect(ofType(l, 'TALK_SCENE'), `Talk Scene in leaf ${n}`).toHaveLength(1);
      if (n % 3 !== 0 && FIRST.get('TS1')! < n - 1) expect(ofType(l, 'TALK_SCENE')).toHaveLength(0);
    }
  });

  it('plays every sound right before its rhyme', () => {
    for (const l of plan.leaves.slice(0, 39)) {
      l.items.forEach((item, index) => {
        if (item.kind !== 'sound') return;
        const rhyme = RHYME_OF_SOUND[item.sound]!;
        if (FIRST.get(rhyme)! <= l.number)
          expect(l.items[index + 1], `leaf ${l.number} ${item.sound}`).toMatchObject({ code: rhyme });
      });
    }
  });

  it('plays every new material and sound in the leaf of its first lesson or the next one', () => {
    for (const m of MATERIALS.filter((m) => m.first <= 36 && !['RT1', 'TT', 'SN'].includes(m.code)))
      expect(codes(leaf(m.first)).includes(m.code) || codes(leaf(m.first + 1)).includes(m.code), m.code).toBe(
        true,
      );
    for (const s of SOUNDS) {
      const label = s.sound.replaceAll(/\s+/g, ' ');
      const inLeaf = (n: number) =>
        leaf(n).items.some((item) => item.kind === 'sound' && item.sound === label);
      expect(inLeaf(s.first) || inLeaf(s.first + 1), label).toBe(true);
    }
  });

  it('balances what children hear: the least-heard item of each kind comes back', () => {
    // Hears per material = lesson uses up to Lesson 36 + leaves 1–36.
    const hears = new Map<string, number>();
    for (const m of MATERIALS) hears.set(m.code, range(1, 36).filter((n) => usedIn(m.first, n)).length);
    for (const n of range(1, 36)) for (const code of codes(leaf(n))) hears.set(code, hears.get(code)! + 1);
    const spread = (list: string[]) => {
      const values = list.map((code) => hears.get(code)!);
      return Math.max(...values) - Math.min(...values);
    };
    // Items taught early get more lesson uses, so listening evens out the totals within a kind.
    expect(spread(['SG1', 'SG2', 'CH1'])).toBeLessThanOrEqual(3);
    expect(spread(['ST1', 'ST2'])).toBeLessThanOrEqual(3);
    expect(spread(['MD1', 'MD2'])).toBeLessThanOrEqual(3);
    // Nothing is forgotten: every material taught by Lesson 20 comes back in leaves 9–36.
    for (const m of MATERIALS.filter((m) => m.first <= 20 && !['RT1', 'TT', 'SN'].includes(m.code))) {
      const later = range(9, 36).filter((n) => n > m.first + 1 && codes(leaf(n)).includes(m.code)).length;
      expect(later, m.code).toBeGreaterThanOrEqual(2);
    }
    // New mixes: no song plays in more than two leaves in a row once three songs are known.
    for (const n of range(9, 34)) {
      const inRow = (code: string) => [n, n + 1, n + 2].every((k) => codes(leaf(k)).includes(code));
      for (const code of ['SG1', 'SG2', 'SG3', 'CH1', 'CH2'])
        expect(inRow(code), `${code} from ${n}`).toBe(false);
    }
  });

  it.each([1, 2, 3])('keeps leaves 1–36 within the home minutes of Level %i', (level) => {
    const { min, max } = listeningHomeMinutes(level);
    for (const durations of [DURATIONS, undefined]) {
      const built = buildListeningPlan(unitSource(level), {
        bridge: BRIDGE,
        favourites: FAVOURITES,
        durations,
      });
      for (const l of built.leaves.slice(0, 36)) {
        const seconds = 30 + l.items.reduce((sum, item) => sum + item.seconds, 0);
        expect(seconds, `leaf ${l.number}`).toBeLessThanOrEqual(max * 60);
        // Early leaves may be short: only what children already know can be added.
        const addable = MATERIALS.filter(
          (m) =>
            ['SONG', 'CHANT', 'RHYME', 'BOOK', 'STORY'].includes(m.type) &&
            m.first <= l.number &&
            !codes(l).includes(m.code) &&
            seconds + (durations ? m.seconds : LISTENING_ESTIMATED_SECONDS[m.type as 'SONG']) <= max * 60,
        );
        if (seconds < min * 60)
          expect(
            addable.map((m) => m.code),
            `leaf ${l.number}`,
          ).toEqual([]);
        expect(l.minutes).toBe(Math.round(seconds / 6) / 10);
      }
    }
  });

  it('keeps every leaf of the Level 2 unit within its home minutes', () => {
    const { min, max } = listeningHomeMinutes(2);
    for (const l of plan.leaves) {
      expect(l.minutes, `leaf ${l.number}`).toBeGreaterThanOrEqual(min);
      expect(l.minutes, `leaf ${l.number}`).toBeLessThanOrEqual(max);
    }
  });

  it('uses audio lengths when known', () => {
    const sg1 = leaf(1).items.find((item) => item.kind === 'material' && item.code === 'SG1');
    expect(sg1?.seconds).toBe(78);
    const estimated = buildListeningPlan(unitSource(), { bridge: BRIDGE });
    const story = estimated.leaves[0]!.items.find(
      (item) => item.kind === 'material' && item.type === 'STORY',
    );
    expect(story?.seconds).toBe(155);
  });

  it('plays every song and chant with Move & Do at the party (leaves 37–38)', () => {
    for (const n of [37, 38]) {
      const l = leaf(n);
      expect(codes(l).filter((c) => /^(SG|CH)/.test(c))).toEqual(['SG1', 'SG2', 'SG3', 'CH1', 'CH2']);
      expect(ofType(l, 'MOVE_AND_DO').length).toBeGreaterThanOrEqual(1);
      expect(l.items.every((item) => ['SONG', 'CHANT', 'MOVE_AND_DO'].includes(types(item)))).toBe(true);
    }
  });

  it('plays the favourites: every rhyme, sound and book (39), then every story (40)', () => {
    const l39 = leaf(39);
    for (const code of ['RH1', 'RH2', 'RH3', 'BB1', 'BB2']) expect(codes(l39)).toContain(code);
    expect(ofType(l39, 'SOUND_TRAIL').map((item) => (item.kind === 'sound' ? item.sound : ''))).toEqual([
      'a /æ/',
      'p /p/',
      'w /w/',
    ]);
    expect(ofType(l39, 'STORY', 'MOVE_AND_DO', 'TALK_SCENE', 'words')).toHaveLength(0);
    const l40 = leaf(40);
    expect(codes(l40).filter((c) => c.startsWith('ST'))).toEqual(['ST1', 'ST2', 'ST3']);
    expect(l40.items.every((item) => ['STORY', 'SONG', 'CHANT'].includes(types(item)))).toBe(true);
  });

  it('groups word cards in sets of six in word order', () => {
    const sets = new Map<string, string[]>();
    for (const l of plan.leaves)
      for (const item of l.items)
        if (item.kind === 'words')
          sets.set(
            item.cards[0]!.cardId,
            item.cards.map((c) => c.text),
          );
    const all = [...sets.values()].sort((a, b) => WORDS.indexOf(a[0]!) - WORDS.indexOf(b[0]!));
    expect(all).toHaveLength(7);
    all.forEach((cards, index) => {
      expect(cards).toHaveLength(6);
      const expected = WORDS.slice(index * 6, index * 6 + 6);
      expect(cards.slice(0, expected.length)).toEqual(expected);
    });
    expect(all[6]).toEqual(['round', 'hungry', 'Here you are', 'smell', 'apple', 'banana']);
  });
});

describe('releaseMedia with Listening Time', () => {
  it('downloads the bridge and favourite songs of the last unit', () => {
    const payload = {
      format: 1,
      version: 1,
      publishedAt: '2026-10-28T00:00:00Z',
      unit: { level: { number: 2 }, sounds: [], places: [] },
      words: [],
      materials: [],
      lessons: [],
      listening: plan,
    } as unknown as UnitReleasePayload;
    expect(
      releaseMedia(payload)
        .map((m) => m.id)
        .sort(),
    ).toEqual(['u04-sg1', 'u04-sg2']);
  });
});
