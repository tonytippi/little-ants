/**
 * Turns a leaf's items into what the player does, step by step: recordings with pictures in time with the audio,
 * or, where there is no recording yet, the device voice reading line by line or page by page. Pure functions; the
 * player runs the segments (see player-runner.ts).
 */
import {
  LISTENING_KIND_COLOURS,
  LISTENING_KIND_LABELS,
  listeningItemKey,
  listeningItemKind,
  type ListenFrame,
  type ListeningItem,
  type ListeningPayload,
  type ReleaseMedia,
} from '@little-ants/shared';
import type { Mode } from './types';

type Material = ListeningPayload['materials'][number];

/** What the screen shows during a segment. */
export interface Slide {
  picture: ReleaseMedia | null;
  /** Text lines; empty strings are gaps between verses. */
  lines: string[];
  /** Index of the line being heard, or -1. */
  current: number;
  /** A big letter (sounds) or word (word cards) in the child font. */
  big?: string;
  /** Small line under the big one, e.g. the sound "/æ/". */
  small?: string;
}

export type Segment =
  /** Play a recording; pictures and highlighted lines follow the playback position. */
  | { type: 'audio'; media: ReleaseMedia; slides: Slide[]; lyrics: string[] | null; fallback: Segment[] }
  /** Read a text with the device voice, then wait `pauseMs` (time for the child to say it). */
  | { type: 'speak'; text: string; rate: number; slide: Slide; pauseMs: number }
  /** Show a slide for `ms`, or until Next when `ms` is null. */
  | { type: 'show'; slide: Slide; ms: number | null };

export interface ItemPlan {
  key: string;
  kind: string;
  kindLabel: string;
  colour: string;
  title: string;
  /** The activity (Listen & Say, Sing & Move …) and its one-line instruction. */
  act: string;
  cue: string;
  segments: Segment[];
}

/** The activity for each kind of item (Programme Guide, Part 3: the 8 activities). */
export const ACTIVITIES: Record<string, { act: string; cue: string }> = {
  WORDS: { act: 'Listen & Say', cue: 'Listen, then say the word. Listen again, say it again!' },
  SONG: { act: 'Sing & Move', cue: 'Stand up! Sing and move!' },
  CHANT: { act: 'Sing & Move', cue: 'Stand up! March and chant to the beat!' },
  RHYME: { act: 'Say What You Hear', cue: 'Listen first. Now say it with me!' },
  SOUND_TRAIL: { act: 'Say What You Hear', cue: 'Say the sound three times, with its gesture!' },
  STORY: { act: "Let's Watch", cue: "Sit like an ant. Let's watch! Join in the repeated line." },
  BOOK: { act: 'Point & Follow', cue: 'Finger up! Follow the words, left to right.' },
  MOVE_AND_DO: { act: 'Stand Up & Do', cue: 'Everybody stand up! Listen and do.' },
  TALK_SCENE: { act: 'Find It!', cue: 'Look at the picture. Who can find it? Point to it!' },
  LOOK_BACK: { act: 'Look Back', cue: 'Our song from the last unit. Sing along!' },
};

const DEFAULT_RATE = 0.9;
const WORD_RATE = 0.8;
/** Pause after each page read by the voice, by kind (time to look, point or do the action). */
const PAGE_PAUSE_MS: Record<string, number> = { STORY: 900, BOOK: 1400, MOVE_AND_DO: 3500, TALK_SCENE: 4500 };
/** Kinds whose text is lyrics (lines highlighted while the recording plays). */
const LYRIC_KINDS = new Set(['SONG', 'CHANT', 'RHYME']);
const LOOK_BACK_HOME_MS = 4000;

const slide = (picture: ReleaseMedia | null, lines: string[] = [], current = -1): Slide => ({
  picture,
  lines,
  current,
});

/** Lines of a text, trimmed, with at most one empty line between verses. */
export function textLines(text: string): string[] {
  const lines: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line || (lines.length && lines[lines.length - 1] !== '')) lines.push(line);
  }
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/** The material's own recording (role "audio"), else any audio file of it. */
export function materialAudio(material: Material): ReleaseMedia | null {
  const audio = material.media.filter((media) => media.kind === 'AUDIO');
  return audio.find((media) => media.role.toLowerCase() === 'audio') ?? audio[0] ?? null;
}

/** The material's poster or first picture. */
export function materialPicture(material: Material): ReleaseMedia | null {
  const images = material.media.filter((media) => media.kind === 'IMAGE');
  return (
    images.find((media) => media.role.toLowerCase() === 'poster') ??
    images[0] ??
    material.pages.find((page) => page.image)?.image ??
    null
  );
}

/** A picture for the unit when an item has none (cover, else the lead character). */
export function unitPicture(payload: ListeningPayload): ReleaseMedia | null {
  return payload.unit.cover ?? payload.unit.leadCharacter?.image ?? null;
}

/**
 * The slide for a playback position (0–1) of a recording: pictures change evenly through the recording,
 * and with lyrics the line being sung is highlighted (an even share of the time per line).
 */
export function audioFrame(segment: Extract<Segment, { type: 'audio' }>, fraction: number): Slide {
  const f = Math.min(Math.max(Number.isFinite(fraction) ? fraction : 0, 0), 0.9999);
  const base = segment.slides[Math.floor(f * segment.slides.length)] ?? slide(null);
  if (!segment.lyrics) return base;
  const sung = segment.lyrics.map((line, index) => (line ? index : -1)).filter((index) => index >= 0);
  const current = sung.length ? sung[Math.floor(f * sung.length)]! : -1;
  return { ...base, lines: segment.lyrics, current };
}

/**
 * The voice reads each line, highlighting it. With several pictures (a song's panels), the pictures move on
 * evenly through the lines.
 */
function readLines(lines: string[], pictures: (ReleaseMedia | null)[], pauseMs: number, rate = DEFAULT_RATE) {
  const spoken = lines.map((line, index) => ({ line, index })).filter(({ line }) => line);
  return spoken.map(({ line, index }, position): Segment => ({
    type: 'speak',
    text: line,
    rate,
    slide: slide(pictures[Math.floor((position / spoken.length) * pictures.length)] ?? null, lines, index),
    pauseMs,
  }));
}

/** The device-voice version of a material: pages one by one, or its text line by line. */
function voiceMaterial(material: Material, fallbackPicture: ReleaseMedia | null): Segment[] {
  const picture = materialPicture(material) ?? fallbackPicture;
  const pages = material.pages.filter((page) => page.text.trim() || page.image);
  const pause = PAGE_PAUSE_MS[material.type] ?? 900;
  const segments: Segment[] = [];
  // Pages with words are read page by page; pages with pictures only illustrate the text.
  if (pages.some((page) => page.text.trim())) {
    if (material.type === 'STORY' || material.type === 'BOOK')
      segments.push({
        type: 'speak',
        text: material.title,
        rate: DEFAULT_RATE,
        slide: slide(picture, [material.title], 0),
        pauseMs: 700,
      });
    for (const page of pages) {
      const text = page.text.trim();
      const pagePicture = page.image ?? picture;
      if (text)
        segments.push({
          type: 'speak',
          text,
          rate: DEFAULT_RATE,
          slide: slide(pagePicture, [text], 0),
          pauseMs: pause,
        });
      else segments.push({ type: 'show', slide: slide(pagePicture), ms: 2500 });
    }
    return segments;
  }
  const lines = textLines(material.fullText);
  const panels = pages.length ? pages.map((page) => page.image ?? picture) : [picture];
  if (!lines.length)
    return panels.map((panel): Segment => ({
      type: 'show',
      slide: slide(panel, [material.title], -1),
      ms: 3000,
    }));
  if (material.type === 'RHYME') {
    // Listen once, then say it together, slower, with time to echo each line.
    segments.push({
      type: 'speak',
      text: `${material.title}.`,
      rate: DEFAULT_RATE,
      slide: slide(picture, lines),
      pauseMs: 300,
    });
    segments.push(...readLines(lines, panels, 300));
    segments.push({
      type: 'speak',
      text: 'Now say it with me!',
      rate: DEFAULT_RATE,
      slide: slide(picture, ['Now say it with me!'], 0),
      pauseMs: 500,
    });
    segments.push(...readLines(lines, panels, 1200, WORD_RATE));
    return segments;
  }
  return readLines(lines, panels, PAGE_PAUSE_MS[material.type] ?? 300);
}

function materialSegments(material: Material, payload: ListeningPayload): Segment[] {
  const fallbackPicture = unitPicture(payload);
  const voice = voiceMaterial(material, fallbackPicture);
  const audio = materialAudio(material);
  const picture = materialPicture(material) ?? fallbackPicture;
  const pages = material.pages.filter((page) => page.text.trim() || page.image);
  if (audio) {
    const lyrics = LYRIC_KINDS.has(material.type) ? textLines(material.fullText) : [];
    const slides = pages.length
      ? pages.map((page) =>
          slide(page.image ?? picture, lyrics.length ? [] : [page.text.trim()], lyrics.length ? -1 : 0),
        )
      : [slide(picture, lyrics.length ? [] : textLines(material.fullText))];
    return [{ type: 'audio', media: audio, slides, lyrics: lyrics.length ? lyrics : null, fallback: voice }];
  }
  // Recordings per page (no single recording): play each page's, reading the ones without.
  if (pages.some((page) => page.audio)) {
    return pages.map((page): Segment => {
      const pageSlide = slide(page.image ?? picture, [page.text.trim()], 0);
      const read: Segment[] = page.text.trim()
        ? [{ type: 'speak', text: page.text.trim(), rate: DEFAULT_RATE, slide: pageSlide, pauseMs: 900 }]
        : [{ type: 'show', slide: pageSlide, ms: 2500 }];
      return page.audio
        ? { type: 'audio', media: page.audio, slides: [pageSlide], lyrics: null, fallback: read }
        : read[0]!;
    });
  }
  return voice;
}

/** "a /æ/" → { letter: "A a", ipa: "/æ/", say: "a" } */
export function soundParts(label: string): { letter: string; ipa: string; say: string } {
  const ipa = /\/[^/\s]+\//.exec(label)?.[0] ?? '';
  const say = /[a-z]/i.exec(label)?.[0]?.toLowerCase() ?? label.trim();
  return { letter: say.length === 1 ? `${say.toUpperCase()} ${say}` : label.trim(), ipa, say };
}

function wordPicture(payload: ListeningPayload, text: string): ReleaseMedia | null {
  const wanted = text.trim().toLowerCase();
  return payload.words.find((word) => word.text.trim().toLowerCase() === wanted)?.image ?? null;
}

function soundSegments(
  item: Extract<ListeningItem, { kind: 'sound' }>,
  payload: ListeningPayload,
): Segment[] {
  const { letter, ipa, say } = soundParts(item.sound);
  const normal = (value: string) => value.replaceAll(/\s+/g, ' ').trim();
  const entry = payload.unit.sounds.find((sound) => normal(sound.sound) === normal(item.sound));
  const words = (entry?.words ?? '')
    .split(/[,;]/)
    .map((word) => word.trim())
    .filter(Boolean);
  const big = (lines: string[], current: number, picture: ReleaseMedia | null): Slide => ({
    ...slide(picture, lines, current),
    big: letter,
    small: ipa,
  });
  if (!words.length)
    return [1, 2, 3].map((): Segment => ({
      type: 'speak',
      text: say,
      rate: WORD_RATE,
      slide: big([], -1, null),
      pauseMs: 1500,
    }));
  const segments: Segment[] = [];
  for (let round = 0; round < 2; round += 1)
    for (const word of words)
      segments.push({
        type: 'speak',
        text: `${word}!`,
        rate: WORD_RATE,
        slide: big([word], 0, wordPicture(payload, word)),
        pauseMs: 1500,
      });
  return segments;
}

function wordSegments(item: Extract<ListeningItem, { kind: 'words' }>, payload: ListeningPayload): Segment[] {
  const segments: Segment[] = [];
  for (const card of item.cards) {
    const word = payload.words.find((entry) => entry.cardId === card.cardId);
    const text = word?.text ?? card.text;
    const cardSlide: Slide = { ...slide(word?.image ?? null, [], -1), big: text };
    // Say – pause (the child says it) – say again – pause.
    for (let round = 0; round < 2; round += 1)
      segments.push({ type: 'speak', text, rate: WORD_RATE, slide: cardSlide, pauseMs: 1800 });
  }
  return segments;
}

function lookBackSegments(
  item: Extract<ListeningItem, { kind: 'lookBack' }>,
  payload: ListeningPayload,
  mode: Mode,
): Segment[] {
  const picture = payload.unit.leadCharacter?.image ?? unitPicture(payload);
  const sing: Segment = {
    type: 'show',
    slide: slide(picture, [item.title, 'Sing it together, then tap next.'], 0),
    // At school the teacher leads the song and moves on; at home the leaf carries on by itself.
    ms: mode === 'school' ? null : LOOK_BACK_HOME_MS,
  };
  if (!item.audio) return [sing];
  return [
    {
      type: 'audio',
      media: item.audio,
      slides: [slide(picture, [item.title], 0)],
      lyrics: null,
      fallback: [sing],
    },
  ];
}

/** The items a leaf plays: a look-back song without a recording is skipped, so the leaf starts at once. */
export function playableItems(items: ListeningItem[]): ListeningItem[] {
  return items.filter((item) => item.kind !== 'lookBack' || item.audio !== null);
}

/** What the player does for one item of a leaf. */
export function planItem(item: ListeningItem, payload: ListeningPayload, mode: Mode): ItemPlan {
  const kind = listeningItemKind(item);
  const activity = ACTIVITIES[kind] ?? ACTIVITIES.SONG!;
  let segments: Segment[];
  switch (item.kind) {
    case 'material': {
      const material = payload.materials.find((entry) => entry.code === item.code);
      segments = material
        ? materialSegments(material, payload)
        : [{ type: 'show', slide: slide(unitPicture(payload), [item.title], -1), ms: 3000 }];
      break;
    }
    case 'sound':
      segments = soundSegments(item, payload);
      break;
    case 'words':
      segments = wordSegments(item, payload);
      break;
    case 'lookBack':
      segments = lookBackSegments(item, payload, mode);
      break;
  }
  return {
    key: listeningItemKey(item),
    kind,
    kindLabel: LISTENING_KIND_LABELS[kind] ?? kind,
    colour: LISTENING_KIND_COLOURS[kind] ?? '#4F7F32',
    title: item.title,
    act: activity.act,
    cue: activity.cue,
    segments,
  };
}

/** What the TV shows for the slide on the phone (Watch on TV at home). */
export function listenFrame(plan: ItemPlan, slide: Slide): ListenFrame {
  return {
    colour: plan.colour,
    kindLabel: plan.kindLabel,
    title: plan.title,
    act: plan.act,
    cue: plan.cue,
    picture: slide.picture,
    cover: plan.kind === 'TALK_SCENE',
    ...(slide.big ? { big: slide.big } : {}),
    ...(slide.small ? { small: slide.small } : {}),
    lines: slide.lines,
    current: slide.current,
  };
}

/** The first picture an item shows (for Library cards). */
export function itemPicture(plan: ItemPlan): ReleaseMedia | null {
  for (const segment of plan.segments) {
    const picture = segment.type === 'audio' ? segment.slides[0]?.picture : segment.slide.picture;
    if (picture) return picture;
  }
  return null;
}

/** The first slide of a segment (what shows before playback moves). */
export function firstSlide(segment: Segment): Slide {
  return segment.type === 'audio' ? audioFrame(segment, 0) : segment.slide;
}

/** True when any part of the item is read by the device voice (no studio recording yet). */
export function usesDeviceVoice(segments: Segment[]): boolean {
  return segments.some((segment) => segment.type === 'speak');
}

export type PlayerAction = 'ended' | 'next' | 'previous' | 'again';

/**
 * Where the player goes after an action on item `index` of `count`: an item that played to its end counts as
 * heard; Next skips it (not heard); past the last item the leaf is finished.
 */
export function stepAfter(
  index: number,
  count: number,
  action: PlayerAction,
): { index: number; finished: boolean; heard: boolean } {
  switch (action) {
    case 'ended':
    case 'next': {
      const next = index + 1;
      return { index: Math.min(next, count - 1), finished: next >= count, heard: action === 'ended' };
    }
    case 'previous':
      return { index: Math.max(0, index - 1), finished: false, heard: false };
    case 'again':
      return { index, finished: false, heard: false };
  }
}
