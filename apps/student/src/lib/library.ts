import {
  listeningItemKey,
  listeningItemKind,
  type ListeningItem,
  type ListeningLeaf,
} from '@little-ants/shared';

/** Library shelves, in the order of the design. */
export const LIBRARY_GROUPS: { title: string; kinds: string[] }[] = [
  { title: 'Songs & chants', kinds: ['SONG', 'CHANT'] },
  { title: 'Stories & books', kinds: ['STORY', 'BOOK'] },
  { title: 'Rhymes & sounds', kinds: ['RHYME', 'SOUND_TRAIL'] },
  { title: 'Move & find', kinds: ['MOVE_AND_DO', 'TALK_SCENE'] },
  { title: 'Picture word cards', kinds: ['WORDS'] },
  { title: 'From the last unit', kinds: ['LOOK_BACK'] },
];

/**
 * Every item of the leaves a child has finished (each once, in the order first met), grouped into the Library
 * shelves. Empty shelves are left out.
 */
export function libraryShelves(
  leaves: ListeningLeaf[],
  finished: ReadonlySet<number>,
): { title: string; items: ListeningItem[] }[] {
  const seen = new Map<string, ListeningItem>();
  for (const leaf of [...leaves].sort((a, b) => a.number - b.number)) {
    if (!finished.has(leaf.number)) continue;
    for (const item of leaf.items) {
      const key = listeningItemKey(item);
      if (!seen.has(key)) seen.set(key, item);
    }
  }
  const items = [...seen.values()];
  return LIBRARY_GROUPS.map((group) => ({
    title: group.title,
    items: items.filter((item) => group.kinds.includes(listeningItemKind(item))),
  })).filter((group) => group.items.length > 0);
}

/** Every distinct item of a unit's leaves, in the order first met (for "Times I heard it"). */
export function unitItems(leaves: ListeningLeaf[]): ListeningItem[] {
  return libraryShelves(leaves, new Set(leaves.map((leaf) => leaf.number))).flatMap((shelf) => shelf.items);
}
