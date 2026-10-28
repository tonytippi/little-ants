import { describe, expect, it } from 'vitest';
import type { ListeningPayload, ReleaseMedia } from '@little-ants/shared';
import { libraryShelves, unitItems } from '../src/lib/library';
import {
  audioFrame,
  planItem,
  soundParts,
  stepAfter,
  textLines,
  usesDeviceVoice,
  type Segment,
} from '../src/lib/player-plan';

const media = (id: string, kind: ReleaseMedia['kind'] = 'IMAGE'): ReleaseMedia => ({
  id,
  kind,
  mimeType: kind === 'AUDIO' ? 'audio/mpeg' : 'image/jpeg',
  url: `https://media.example/${id}`,
  sizeBytes: 100,
  fileName: id,
});

const payload: ListeningPayload = {
  version: 3,
  publishedAt: '2026-10-20T00:00:00.000Z',
  unit: {
    code: 'U05',
    number: 5,
    title: 'Yummy Garden',
    level: { number: 2, name: 'Busy Ants' },
    leadCharacter: { name: 'Annie', image: media('annie') },
    cover: media('cover'),
    sounds: [{ sound: 'a /æ/', words: 'ant, apple' }],
  },
  leaves: [
    {
      number: 1,
      stage: 'LOOK_BACK_AND_MEET',
      minutes: 9,
      items: [
        {
          kind: 'lookBack',
          unitCode: 'U04',
          materialCode: 'SG1',
          title: 'Old MacDonald',
          audio: null,
          seconds: 90,
        },
        { kind: 'words', title: 'Word cards: fruit', cards: [{ cardId: 'W1', text: 'apple' }], seconds: 60 },
        { kind: 'material', code: 'SG1', type: 'SONG', title: 'In Our Yummy Garden', seconds: 78 },
        { kind: 'sound', code: 'SN', sound: 'a /æ/', title: 'a /æ/', seconds: 25 },
      ],
    },
    {
      number: 2,
      stage: 'LOOK_BACK_AND_MEET',
      minutes: 9,
      items: [
        { kind: 'material', code: 'RH1', type: 'RHYME', title: 'Apple, Apple', seconds: 40 },
        { kind: 'material', code: 'ST1', type: 'STORY', title: "Annie's Big Basket", seconds: 150 },
        { kind: 'material', code: 'SG1', type: 'SONG', title: 'In Our Yummy Garden', seconds: 78 },
      ],
    },
  ],
  bridge: null,
  materials: [
    {
      code: 'SG1',
      type: 'SONG',
      title: 'In Our Yummy Garden',
      fullText: 'This is the way\n\n\nwe pick the apples\n',
      actions: '',
      pages: [
        { number: 1, text: '', image: media('sg1-p1'), audio: null },
        { number: 2, text: '', image: media('sg1-p2'), audio: null },
      ],
      media: [{ ...media('sg1-audio', 'AUDIO'), role: 'audio' }],
    },
    {
      code: 'RH1',
      type: 'RHYME',
      title: 'Apple, Apple',
      fullText: 'Apple, apple,\nred and round.',
      actions: '',
      pages: [],
      media: [{ ...media('rh1-poster'), role: 'poster' }],
    },
    {
      code: 'ST1',
      type: 'STORY',
      title: "Annie's Big Basket",
      fullText: '',
      actions: '',
      pages: [
        { number: 1, text: 'Annie has a big basket.', image: media('st1-p1'), audio: null },
        { number: 2, text: 'Apple, in you go!', image: media('st1-p2'), audio: null },
      ],
      media: [],
    },
  ],
  words: [{ cardId: 'W1', text: 'apple', image: media('apple') }],
};

const leaf = (number: number) => payload.leaves.find((entry) => entry.number === number)!;
const item = (number: number, index: number) => leaf(number).items[index]!;

describe('text helpers', () => {
  it('keeps one gap between verses and trims the ends', () => {
    expect(textLines('  a \n\n\n b\n\n')).toEqual(['a', '', 'b']);
  });

  it('splits a sound label into letter, IPA and what to say', () => {
    expect(soundParts('a /æ/')).toEqual({ letter: 'A a', ipa: '/æ/', say: 'a' });
  });
});

describe('planning an item', () => {
  it('plays a song recording with its pictures, highlighting the lyrics, with the voice as fallback', () => {
    const plan = planItem(item(1, 2), payload, 'home');
    expect(plan).toMatchObject({ key: 'SG1', kind: 'SONG', act: 'Sing & Move', colour: '#D2564B' });
    expect(plan.segments).toHaveLength(1);
    const segment = plan.segments[0] as Extract<Segment, { type: 'audio' }>;
    expect(segment.type).toBe('audio');
    expect(segment.media.id).toBe('sg1-audio');
    expect(segment.slides.map((slide) => slide.picture?.id)).toEqual(['sg1-p1', 'sg1-p2']);
    // Without the recording (offline, not downloaded) the voice reads the lyrics over the song's panels.
    expect(
      segment.fallback.map((entry) => entry.type === 'speak' && [entry.text, entry.slide.picture?.id]),
    ).toEqual([
      ['This is the way', 'sg1-p1'],
      ['we pick the apples', 'sg1-p2'],
    ]);
    expect(usesDeviceVoice(plan.segments)).toBe(false);

    const start = audioFrame(segment, 0);
    expect(start.picture?.id).toBe('sg1-p1');
    expect(start.lines).toEqual(['This is the way', '', 'we pick the apples']);
    expect(start.current).toBe(0);
    const end = audioFrame(segment, 0.9);
    expect(end.picture?.id).toBe('sg1-p2');
    expect(end.current).toBe(2);
    expect(audioFrame(segment, Number.NaN).current).toBe(0);
  });

  it('reads a rhyme without a recording twice with the voice: listen, then say it together', () => {
    const plan = planItem(item(2, 0), payload, 'home');
    expect(plan.act).toBe('Say What You Hear');
    const spoken = plan.segments.map((segment) => (segment.type === 'speak' ? segment.text : segment.type));
    expect(spoken).toEqual([
      'Apple, Apple.',
      'Apple, apple,',
      'red and round.',
      'Now say it with me!',
      'Apple, apple,',
      'red and round.',
    ]);
    expect(
      plan.segments.every(
        (segment) => segment.type !== 'speak' || segment.slide.picture?.id === 'rh1-poster',
      ),
    ).toBe(true);
  });

  it('reads a story page by page with its pictures', () => {
    const plan = planItem(item(2, 1), payload, 'home');
    expect(plan.act).toBe("Let's Watch");
    const pages = plan.segments.filter((segment) => segment.type === 'speak');
    expect(pages.map((segment) => segment.type === 'speak' && segment.text)).toEqual([
      "Annie's Big Basket",
      'Annie has a big basket.',
      'Apple, in you go!',
    ]);
    expect(pages.map((segment) => segment.type === 'speak' && segment.slide.picture?.id)).toEqual([
      'st1-p1',
      'st1-p1',
      'st1-p2',
    ]);
  });

  it('says each word card twice (say – pause – say), large in the child font', () => {
    const plan = planItem(item(1, 1), payload, 'home');
    expect(plan.act).toBe('Listen & Say');
    expect(plan.segments).toHaveLength(2);
    for (const segment of plan.segments) {
      expect(segment).toMatchObject({ type: 'speak', text: 'apple', pauseMs: 1800 });
      expect(segment.type === 'speak' && segment.slide).toMatchObject({ big: 'apple' });
    }
  });

  it('shows the letter of a sound and says its words twice', () => {
    const plan = planItem(item(1, 3), payload, 'home');
    const texts = plan.segments.map((segment) => segment.type === 'speak' && segment.text);
    expect(texts).toEqual(['ant!', 'apple!', 'ant!', 'apple!']);
    expect(plan.segments[1]!.type === 'speak' && plan.segments[1]!.slide).toMatchObject({
      big: 'A a',
      small: '/æ/',
      picture: { id: 'apple' },
    });
  });

  it('shows a look-back song without a recording: a moment at home, until Next at school', () => {
    const home = planItem(item(1, 0), payload, 'home');
    expect(home.segments).toEqual([expect.objectContaining({ type: 'show', ms: 4000 })]);
    const school = planItem(item(1, 0), payload, 'school');
    expect(school.segments).toEqual([expect.objectContaining({ type: 'show', ms: null })]);
  });
});

describe('player steps', () => {
  it('counts an item heard only when it plays to its end, and finishes after the last', () => {
    expect(stepAfter(0, 3, 'ended')).toEqual({ index: 1, finished: false, heard: true });
    expect(stepAfter(0, 3, 'next')).toEqual({ index: 1, finished: false, heard: false });
    expect(stepAfter(2, 3, 'ended')).toEqual({ index: 2, finished: true, heard: true });
    expect(stepAfter(0, 3, 'previous')).toEqual({ index: 0, finished: false, heard: false });
    expect(stepAfter(2, 3, 'previous')).toEqual({ index: 1, finished: false, heard: false });
    expect(stepAfter(1, 3, 'again')).toEqual({ index: 1, finished: false, heard: false });
  });
});

describe('library', () => {
  it('lists each item of the finished leaves once, by shelf', () => {
    const shelves = libraryShelves(payload.leaves, new Set([1]));
    expect(shelves.map((shelf) => shelf.title)).toEqual([
      'Songs & chants',
      'Rhymes & sounds',
      'Picture word cards',
      'From the last unit',
    ]);
    expect(libraryShelves(payload.leaves, new Set())).toEqual([]);
    expect(unitItems(payload.leaves)).toHaveLength(6);
  });
});
