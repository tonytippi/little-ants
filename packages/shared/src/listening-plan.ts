/**
 * Listening Time: the 40 "leaves" (short playlists) of a unit, one per lesson, generated from the
 * unit's lessons and materials by the rules of the Listening Time Programme Guide.
 *
 * Material types map to listening kinds as follows (the importer derives the type from the code
 * prefix): SONG (SG) and CHANT (CH) share the song slots; RHYME (RH), STORY (ST), BOOK (BB),
 * MOVE_AND_DO (MD) and TALK_SCENE (TS) have their own slots. SOUND_TRAIL is one material (code SN)
 * whose sounds are listed in `unit.sounds`; each sound becomes its own item. Routines, Tiny Tracks,
 * Home Hill and other materials are not part of Listening Time.
 */
import type { ReleaseLesson, ReleaseMaterial, ReleaseMedia, ReleaseStep, ReleaseWord } from './release.js';

export const LISTENING_LEAF_COUNT = 40;

export type ListeningStage = 'LOOK_BACK_AND_MEET' | 'LISTEN_AND_JOIN_IN' | 'PARTY' | 'FAVOURITES';

export const LISTENING_STAGE_LABELS: Record<ListeningStage, string> = {
  LOOK_BACK_AND_MEET: 'Look back & meet',
  LISTEN_AND_JOIN_IN: 'Listen & join in',
  PARTY: 'Party playlist',
  FAVOURITES: 'My favourites',
};

/** A song from the previous unit, played at the start of leaves 1–8. */
export interface ListeningBridge {
  unitCode: string;
  materialCode: string;
  title: string;
  audio: ReleaseMedia | null;
}

export type ListeningItem =
  /** A song, chant, rhyme, story, book, Move & Do or Talk Scene of this unit. */
  | { kind: 'material'; code: string; type: string; title: string; seconds: number }
  /** One sound of the unit's Sound Trail material, e.g. "a /æ/". */
  | { kind: 'sound'; code: string; sound: string; title: string; seconds: number }
  /** A set of picture word cards (Listen & Say). */
  | { kind: 'words'; title: string; cards: { cardId: string; text: string }[]; seconds: number }
  /** The bridge song (leaves 1–5) or another favourite (leaves 6–8) from the previous unit. */
  | ({ kind: 'lookBack'; seconds: number } & ListeningBridge);

export interface ListeningLeaf {
  number: number;
  stage: ListeningStage;
  items: ListeningItem[];
  /** Audio length including the short hello and goodbye, rounded to 0.1 minute. */
  minutes: number;
}

export interface ListeningPlan {
  leaves: ListeningLeaf[];
  bridge: ListeningBridge | null;
}

/** Home listening time per level (Programme Guide, Part 1). Level 2 "about 10 minutes" is read as 8–12. */
export const LISTENING_HOME_MINUTES: Record<1 | 2 | 3, { min: number; max: number }> = {
  1: { min: 6, max: 9 },
  2: { min: 8, max: 12 },
  3: { min: 10, max: 15 },
};

export function listeningHomeMinutes(levelNumber: number): { min: number; max: number } {
  if (levelNumber <= 1) return LISTENING_HOME_MINUTES[1];
  if (levelNumber === 2) return LISTENING_HOME_MINUTES[2];
  return LISTENING_HOME_MINUTES[3];
}

/**
 * Seconds per item when the audio length is unknown. Averages of the Unit 5 recordings and
 * planned scripts used by the first Listening Time prototype.
 */
export const LISTENING_ESTIMATED_SECONDS = {
  SONG: 60,
  CHANT: 32,
  RHYME: 35,
  SOUND_TRAIL: 25,
  STORY: 155,
  BOOK: 85,
  MOVE_AND_DO: 75,
  TALK_SCENE: 60,
  WORDS: 60,
  LOOK_BACK: 90,
  /** Hello at the start and the star at the end of every leaf. */
  HELLO_GOODBYE: 30,
} as const;

/** Colours per item kind from the program's brand palette, as used by the Listening Time app. */
export const LISTENING_KIND_COLOURS: Record<string, string> = {
  SONG: '#D2564B',
  CHANT: '#E08A3C',
  RHYME: '#9479B5',
  SOUND_TRAIL: '#7A4E32',
  STORY: '#4F86B8',
  BOOK: '#6E9A45',
  MOVE_AND_DO: '#C9961E',
  TALK_SCENE: '#3E9A8F',
  WORDS: '#4F7F32',
  LOOK_BACK: '#D2564B',
};

export const LISTENING_KIND_LABELS: Record<string, string> = {
  SONG: 'Song',
  CHANT: 'Chant',
  RHYME: 'Rhyme',
  SOUND_TRAIL: 'Sound',
  STORY: 'Story',
  BOOK: 'Book',
  MOVE_AND_DO: 'Move & Do',
  TALK_SCENE: 'Talk Scene',
  WORDS: 'Word cards',
  LOOK_BACK: 'Last unit',
};

/** The colour key of an item, matching LISTENING_KIND_COLOURS. */
export function listeningItemKind(item: ListeningItem): string {
  if (item.kind === 'material') return item.type;
  if (item.kind === 'sound') return 'SOUND_TRAIL';
  if (item.kind === 'words') return 'WORDS';
  return 'LOOK_BACK';
}

export const WORD_SET_SIZE = 6;

/** The parts of a release payload the plan is built from. */
export interface ListeningSource {
  unit: { level: { number: number }; sounds: { sound: string; words: string }[] };
  words: Pick<ReleaseWord, 'cardId' | 'text' | 'group'>[];
  materials: Pick<ReleaseMaterial, 'code' | 'type' | 'title'>[];
  lessons: (Pick<ReleaseLesson, 'number'> &
    Partial<Pick<ReleaseLesson, 'keyLanguage' | 'goals'>> & {
      steps: (Pick<ReleaseStep, 'kind' | 'title' | 'materialCode'> &
        Partial<Pick<ReleaseStep, 'teacherText' | 'childrenText'>>)[];
    })[];
}

export interface ListeningPlanOptions {
  /** The previous unit's bridge song (its SG1), or null for the first unit / an unpublished previous unit. */
  bridge: ListeningBridge | null;
  /** Other songs of the previous unit for leaves 6–8; the bridge song is used when empty. */
  favourites?: ListeningBridge[];
  /** Known audio lengths in seconds by material code; estimates are used for the rest. */
  durations?: Record<string, number>;
}

type SongKind = 'SONG' | 'CHANT';
type EntryKind =
  SongKind | 'RHYME' | 'SOUND_TRAIL' | 'STORY' | 'BOOK' | 'MOVE_AND_DO' | 'TALK_SCENE' | 'WORDS';

const LISTENING_TYPES = new Set<string>([
  'SONG',
  'CHANT',
  'RHYME',
  'SOUND_TRAIL',
  'STORY',
  'BOOK',
  'MOVE_AND_DO',
  'TALK_SCENE',
]);

interface Entry {
  id: string;
  kind: EntryKind;
  /** Lesson the item is first taught in (Infinity when no lesson uses it). */
  first: number;
  /** Stable tie-break: position in the unit's material / sound / word order. */
  order: number;
  /** Lessons that use the item, ascending. */
  lessons: number[];
  /** The sound or rhyme it is paired with, if any. */
  partner?: Entry;
  item: ListeningItem;
}

/** Ranks that decide where an item sits in the leaf (the order of a Listening Time session). */
const RANK = {
  lookBack: 0,
  words: 1,
  songA: 2,
  soundRhyme: 3,
  story: 5,
  book: 6,
  move: 7,
  scene: 8,
  songB: 9,
  extra: 10,
} as const;

/** Which items are dropped first when a leaf is too long (lower goes first; absent = never). */
const DROP_ORDER: Partial<Record<keyof typeof RANK, number>> = {
  extra: 0,
  scene: 1,
  book: 2,
  songB: 3,
  move: 4,
  words: 6,
};
const DROP_RHYME = 5;

interface Placed {
  entry: Entry;
  rank: number;
  sub: number;
  drop: number | undefined;
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function lessonText(lesson: ListeningSource['lessons'][number]): string {
  return [
    lesson.keyLanguage ?? '',
    ...(lesson.goals ?? []),
    ...lesson.steps.flatMap((step) => [step.title, step.teacherText ?? '', step.childrenText ?? '']),
  ]
    .join('\n')
    .toLowerCase();
}

/** "a /æ/" → "/æ/"; labels without an IPA part are matched as written. */
function soundToken(label: string): string {
  return (/\/[^/\s]+\//.exec(label)?.[0] ?? label.trim()).toLowerCase();
}

/** "a /æ/" → "a" */
function soundLetter(label: string): string {
  return /[a-z]/i.exec(label)?.[0]?.toLowerCase() ?? '';
}

function wordSetTitle(cards: Pick<ReleaseWord, 'group' | 'text'>[], index: number): string {
  const groups = [...new Set(cards.map((card) => card.group.trim()).filter(Boolean))];
  return groups.length ? `Word cards: ${groups.join(', ')}` : `Word cards ${index + 1}`;
}

function buildEntries(source: ListeningSource, options: ListeningPlanOptions) {
  const durations = options.durations ?? {};
  const lessons = [...source.lessons].sort((a, b) => a.number - b.number);
  const usesOf = (match: (step: ListeningSource['lessons'][number]['steps'][number]) => boolean) =>
    lessons.filter((lesson) => lesson.steps.some(match)).map((lesson) => lesson.number);

  const materials = source.materials.filter((material) => LISTENING_TYPES.has(material.type));
  const trail = materials.find((material) => material.type === 'SOUND_TRAIL');
  const entries: Entry[] = [];

  materials.forEach((material, order) => {
    if (material.type === 'SOUND_TRAIL') return;
    const lessonsUsed = usesOf((step) => step.materialCode === material.code);
    const type = material.type as Exclude<EntryKind, 'WORDS' | 'SOUND_TRAIL'>;
    entries.push({
      id: material.code,
      kind: type,
      first: lessonsUsed[0] ?? Infinity,
      order,
      lessons: lessonsUsed,
      item: {
        kind: 'material',
        code: material.code,
        type,
        title: material.title,
        seconds: durations[material.code] ?? LISTENING_ESTIMATED_SECONDS[type],
      },
    });
  });

  // Sounds: a lesson teaches a sound when its Sound Trail step names it (by IPA, e.g. "/æ/").
  // A sound no step names is taken as known from the Sound Trail's first lesson.
  const sounds: Entry[] = [];
  if (trail) {
    const isTrailStep = (step: ListeningSource['lessons'][number]['steps'][number]) =>
      step.materialCode === trail.code || step.kind === 'SOUND_TRAIL';
    const trailLessons = usesOf(isTrailStep);
    const labels = source.unit.sounds.length
      ? source.unit.sounds.map((sound) => sound.sound.replaceAll(/\s+/g, ' ').trim())
      : [trail.title];
    labels.forEach((label, order) => {
      const token = soundToken(label);
      const named = lessons
        .filter((lesson) =>
          lesson.steps.some(
            (step) =>
              isTrailStep(step) &&
              `${step.title}\n${step.teacherText ?? ''}\n${step.childrenText ?? ''}`
                .toLowerCase()
                .includes(token),
          ),
        )
        .map((lesson) => lesson.number);
      const used = named.length ? named : trailLessons;
      sounds.push({
        id: `${trail.code}:${label}`,
        kind: 'SOUND_TRAIL',
        first: used[0] ?? Infinity,
        order: materials.length + order,
        lessons: used,
        item: {
          kind: 'sound',
          code: trail.code,
          sound: label,
          title: label,
          seconds: durations[trail.code] ?? LISTENING_ESTIMATED_SECONDS.SOUND_TRAIL,
        },
      });
    });
  }

  // Each sound is paired with the rhyme whose title starts with the sound's letter ("a" → "Apple,
  // Apple"); sounds left over are paired with the remaining rhymes in code order.
  const rhymes = entries.filter((entry) => entry.kind === 'RHYME');
  const free = new Set(rhymes);
  const pair = (sound: Entry, rhyme: Entry): void => {
    sound.partner = rhyme;
    rhyme.partner = sound;
    free.delete(rhyme);
  };
  for (const sound of sounds) {
    const letter = soundLetter(sound.item.title);
    const rhyme = [...free].find(
      (entry) => letter && entry.item.title.trim().toLowerCase().startsWith(letter),
    );
    if (rhyme) pair(sound, rhyme);
  }
  for (const sound of sounds) {
    const rhyme = [...free][0];
    if (!sound.partner && rhyme) pair(sound, rhyme);
  }
  entries.push(...sounds);

  // Word-card sets: the words in order, six at a time; the last set is topped up from the start.
  // A word is known from the first lesson whose texts mention it; a set is known when all its
  // mentioned words are (a set none of whose words is mentioned is known from Lesson 1).
  const texts = lessons.map((lesson) => ({ number: lesson.number, text: lessonText(lesson) }));
  const words = source.words.filter((word) => word.text.trim());
  const mentioned = words.map((word) => {
    const pattern = new RegExp(`\\b${escapeRegExp(word.text.trim().toLowerCase())}(?:s|es)?\\b`, 'u');
    return texts.find((lesson) => pattern.test(lesson.text))?.number ?? null;
  });
  for (let start = 0, index = 0; start < words.length; start += WORD_SET_SIZE, index += 1) {
    const picks = words.map((_, i) => i).slice(start, start + WORD_SET_SIZE);
    for (let i = 0; picks.length < WORD_SET_SIZE && picks.length < words.length; i += 1) picks.push(i);
    const cards = picks.map((i) => words[i]!);
    const firsts = picks.map((i) => mentioned[i]).filter((value): value is number => value !== null);
    entries.push({
      id: `WORDS:${index + 1}`,
      kind: 'WORDS',
      first: firsts.length ? Math.max(...firsts) : 1,
      order: index,
      lessons: [],
      item: {
        kind: 'words',
        title: wordSetTitle(cards, index),
        cards: cards.map((card) => ({ cardId: card.cardId, text: card.text })),
        seconds: LISTENING_ESTIMATED_SECONDS.WORDS,
      },
    });
  }
  return entries;
}

function stageOf(number: number): ListeningStage {
  if (number <= 8) return 'LOOK_BACK_AND_MEET';
  if (number <= 36) return 'LISTEN_AND_JOIN_IN';
  if (number <= 38) return 'PARTY';
  return 'FAVOURITES';
}

/**
 * Build the 40 leaves. Pure and deterministic: the same input always gives the same plan.
 *
 * - A leaf plays only items first taught on or before its lesson.
 * - Leaves 1–5 start with the bridge song, 6–8 with a favourite from the previous unit.
 * - Leaves 1–8: word cards, a song or chant, a sound + its rhyme, a story or book, a Move & Do.
 * - Leaves 9–36: word cards, two songs/chants, a sound + its rhyme, a story, a book on even leaves,
 *   a Move & Do, the Talk Scene every third leaf.
 * - Items taught in the leaf's lesson or the one before are picked first (and added if no slot
 *   took them); otherwise the least-heard item of each kind (lesson uses + earlier leaves),
 *   preferring one the previous leaf did not play so each leaf is a new mix.
 * - Leaves 1–36 are trimmed or topped up to the level's home minutes.
 * - Leaves 37–38: every song and chant + Move & Do; 39: every rhyme, sound and book; 40: every story.
 *   These keep all their items even when that is longer than the home time.
 */
export function buildListeningPlan(source: ListeningSource, options: ListeningPlanOptions): ListeningPlan {
  const entries = buildEntries(source, options);
  const range = listeningHomeMinutes(source.unit.level.number);
  const maxSeconds = range.max * 60;
  const minSeconds = range.min * 60;
  const leafHeard = new Map<string, number>();
  /** Items of the previous leaf: avoided when another item of the kind can play, for new mixes. */
  let previous = new Set<string>();
  const varied = (list: Entry[]): Entry[] => {
    const other = list.filter((entry) => !previous.has(entry.id));
    return other.length ? other : list;
  };
  const favourites = options.favourites?.length ? options.favourites : options.bridge ? [options.bridge] : [];

  const known = (entry: Entry, n: number): boolean => entry.first <= n;
  const isNew = (entry: Entry, n: number): boolean => entry.first === n || entry.first === n - 1;
  const heard = (entry: Entry, n: number): number =>
    entry.lessons.filter((lesson) => lesson <= n).length + (leafHeard.get(entry.id) ?? 0);
  const leastHeard = (list: Entry[], n: number): Entry[] =>
    [...list].sort((a, b) => heard(a, n) - heard(b, n) || b.first - a.first || a.order - b.order);
  const ofKind = (kinds: EntryKind[], n: number): Entry[] =>
    entries.filter((entry) => kinds.includes(entry.kind) && known(entry, n));

  const lookBackItem = (n: number): ListeningItem | null => {
    if (n > 8) return null;
    const song = n <= 5 ? options.bridge : favourites[(n - 6) % Math.max(favourites.length, 1)];
    return song ? { kind: 'lookBack', ...song, seconds: LISTENING_ESTIMATED_SECONDS.LOOK_BACK } : null;
  };

  const buildLessonLeaf = (n: number): ListeningItem[] => {
    const lookBack = lookBackItem(n);
    const base = LISTENING_ESTIMATED_SECONDS.HELLO_GOODBYE + (lookBack?.seconds ?? 0);
    const placed: Placed[] = [];
    const seconds = (): number => base + placed.reduce((sum, p) => sum + p.entry.item.seconds, 0);
    const used = new Set<string>();
    const put = (entry: Entry | undefined, slot: keyof typeof RANK, sub = 0): void => {
      if (!entry || used.has(entry.id)) return;
      used.add(entry.id);
      placed.push({ entry, rank: RANK[slot], sub, drop: DROP_ORDER[slot] });
    };
    const pick = (kinds: EntryKind[]): Entry | undefined => {
      const candidates = ofKind(kinds, n).filter((entry) => !used.has(entry.id));
      const fresh = candidates.filter((entry) => isNew(entry, n));
      return leastHeard(fresh.length ? fresh : varied(candidates), n)[0];
    };
    /** A sound and its rhyme travel together; the pair counts as new or heard as a whole. */
    const putSoundRhyme = (entry: Entry, sub: number): void => {
      const sound = entry.kind === 'SOUND_TRAIL' ? entry : entry.partner;
      const rhyme = entry.kind === 'RHYME' ? entry : entry.partner;
      if (sound && known(sound, n)) put(sound, 'soundRhyme', sub * 2);
      if (rhyme && known(rhyme, n)) {
        put(rhyme, 'soundRhyme', sub * 2 + 1);
        const last = placed[placed.length - 1];
        if (last?.entry === rhyme) last.drop = DROP_RHYME;
      }
    };
    const pickSoundRhyme = (): Entry | undefined => {
      const pairs = ofKind(['SOUND_TRAIL', 'RHYME'], n).filter(
        (entry) =>
          !used.has(entry.id) && (entry.kind === 'SOUND_TRAIL' || !entry.partner || !known(entry.partner, n)),
      );
      const score = (entry: Entry): number =>
        heard(entry, n) + (entry.partner && known(entry.partner, n) ? heard(entry.partner, n) : 0);
      const fresh = pairs.filter(
        (entry) => isNew(entry, n) || (!!entry.partner && known(entry.partner, n) && isNew(entry.partner, n)),
      );
      return [...(fresh.length ? fresh : varied(pairs))].sort(
        (a, b) => score(a) - score(b) || b.first - a.first || a.order - b.order,
      )[0];
    };

    put(pick(['WORDS']), 'words');
    put(pick(['SONG', 'CHANT']), 'songA');
    const pairEntry = pickSoundRhyme();
    if (pairEntry) putSoundRhyme(pairEntry, 0);
    if (n <= 8) {
      const tale = pick(['STORY', 'BOOK']);
      put(tale, tale?.kind === 'BOOK' ? 'book' : 'story');
      if (tale?.kind === 'BOOK') placed[placed.length - 1]!.drop = undefined;
    } else {
      put(pick(['STORY']), 'story');
      if (n % 2 === 0) put(pick(['BOOK']), 'book');
    }
    put(pick(['MOVE_AND_DO']), 'move');
    if (n > 8 && n % 3 === 0) put(pick(['TALK_SCENE']), 'scene');
    if (n > 8) put(pick(['SONG', 'CHANT']), 'songB');

    // New items get priority: add any taught today or yesterday that no slot took.
    let pairIndex = 1;
    for (const entry of entries) {
      if (used.has(entry.id) || !known(entry, n) || !isNew(entry, n) || entry.kind === 'WORDS') continue;
      if (entry.kind === 'SOUND_TRAIL' || entry.kind === 'RHYME') putSoundRhyme(entry, pairIndex++);
      else if (entry.kind === 'SONG' || entry.kind === 'CHANT') put(entry, 'songB');
      else if (entry.kind === 'MOVE_AND_DO') put(entry, 'move');
      else if (entry.kind === 'TALK_SCENE') put(entry, 'scene');
      else put(entry, entry.kind === 'BOOK' ? 'book' : 'extra', 1);
    }

    // Too long: drop optional items, keeping today's new items as long as possible.
    for (const keepNew of [true, false]) {
      while (seconds() > maxSeconds) {
        const droppable = placed
          .filter((p) => p.drop !== undefined && !(keepNew && isNew(p.entry, n)))
          .sort((a, b) => a.drop! - b.drop! || b.rank - a.rank);
        const victim = droppable[0];
        if (!victim) break;
        placed.splice(placed.indexOf(victim), 1);
        used.delete(victim.entry.id);
      }
    }

    // Too short: add the least-heard song or chant, then rhyme, book, story that still fits.
    for (const kinds of [['SONG', 'CHANT'], ['RHYME'], ['BOOK'], ['STORY']] as EntryKind[][]) {
      while (seconds() < minSeconds) {
        const total = seconds();
        const extra = leastHeard(varied(ofKind(kinds, n).filter((entry) => !used.has(entry.id))), n).find(
          (entry) => total + entry.item.seconds <= maxSeconds,
        );
        if (!extra) break;
        put(extra, 'extra');
      }
    }

    placed.sort((a, b) => a.rank - b.rank || a.sub - b.sub);
    for (const p of placed) leafHeard.set(p.entry.id, (leafHeard.get(p.entry.id) ?? 0) + 1);
    previous = used;
    return [...(lookBack ? [lookBack] : []), ...placed.map((p) => p.entry.item)];
  };

  /** Fixed playlists (37–40) keep every item; songs top them up to the home minimum. */
  const buildCelebrationLeaf = (n: number): ListeningItem[] => {
    const list: Entry[] = [];
    const add = (entry: Entry | undefined): void => {
      if (entry && !list.includes(entry)) list.push(entry);
    };
    const total = (): number =>
      LISTENING_ESTIMATED_SECONDS.HELLO_GOODBYE + list.reduce((sum, entry) => sum + entry.item.seconds, 0);
    const topUp = (kinds: EntryKind[]): void => {
      while (total() < minSeconds) {
        const extra = leastHeard(
          ofKind(kinds, n).filter((entry) => !list.includes(entry)),
          n,
        ).find((entry) => total() + entry.item.seconds <= maxSeconds);
        if (!extra) break;
        add(extra);
      }
    };
    if (n <= 38) {
      ofKind(['SONG'], n).forEach(add);
      ofKind(['CHANT'], n).forEach(add);
      add(leastHeard(ofKind(['MOVE_AND_DO'], n), n)[0]);
      topUp(['MOVE_AND_DO']);
    } else if (n === 39) {
      for (const sound of ofKind(['SOUND_TRAIL'], n)) {
        add(sound);
        if (sound.partner && known(sound.partner, n)) add(sound.partner);
      }
      ofKind(['RHYME'], n).forEach(add);
      ofKind(['BOOK'], n).forEach(add);
      topUp(['SONG', 'CHANT']);
    } else {
      ofKind(['STORY'], n).forEach(add);
      topUp(['SONG', 'CHANT']);
    }
    for (const entry of list) leafHeard.set(entry.id, (leafHeard.get(entry.id) ?? 0) + 1);
    return list.map((entry) => entry.item);
  };

  const leaves: ListeningLeaf[] = [];
  for (let n = 1; n <= LISTENING_LEAF_COUNT; n += 1) {
    const items = n <= 36 ? buildLessonLeaf(n) : buildCelebrationLeaf(n);
    const total =
      LISTENING_ESTIMATED_SECONDS.HELLO_GOODBYE + items.reduce((sum, item) => sum + item.seconds, 0);
    leaves.push({ number: n, stage: stageOf(n), items, minutes: Math.round(total / 6) / 10 });
  }
  return { leaves, bridge: options.bridge };
}
