import path from 'node:path';

/** Material file roles the importer owns: on every import they are set to exactly what the source folder holds. */
export const IMPORTED_ROLES = ['draft-layout', 'poster', 'audio', 'print'] as const;
export type ImportedRole = (typeof IMPORTED_ROLES)[number];

export interface MaterialLink {
  materialCode: string;
  role: ImportedRole;
  order: number;
  file: string;
}

export interface WordImage {
  cardId: string;
  file: string;
}

/** Picture of one page of a story, book or Tiny Tracks ("U05_ST1_p3.png" → page 3 of ST1). */
export interface PageImage {
  materialCode: string;
  number: number;
  file: string;
}

/** Unit-level picture: the cover or a place ("garden"). */
export interface UnitPicture {
  role: 'cover' | 'place';
  label: string;
  order: number;
  file: string;
}

export interface MediaPlan {
  links: MaterialLink[];
  words: WordImage[];
  pictures: UnitPicture[];
  pages: PageImage[];
  /** Files left out, with the reason (shown in the import report). */
  ignored: { file: string; reason: string }[];
}

export interface MediaSources {
  /** Unit code, e.g. "U05". */
  unitCode: string;
  /** 04_Design/DRAFT PDFs. */
  draftDesigns: string[];
  /** Everything under 04_Design/FINAL. */
  finalFiles: string[];
  /** Unit audio (05_Audio-Video) and program-wide audio (00_ROUTINES-AUDIO). */
  audio: string[];
  materials: { code: string; type: string }[];
  words: { cardId: string; text: string }[];
}

/** Draft layout PDFs are named like "U01_ST1_Who-Is-This_DRAFT.pdf"; the second part is the material code. */
export function materialCodeFromDesignFile(file: string): string | null {
  const parts = path.basename(file).split('_');
  return parts.length > 2 ? (parts[1] ?? null) : null;
}

const POSTER_TYPES = new Set(['SONG', 'CHANT', 'RHYME', 'ROUTINE']);

/**
 * Materials a draft file belongs to: one material ("U01_ST1_…"), every material of a family
 * ("U01_MD_Move-and-Do-Cards" → MD1, MD2, MD3) or every poster ("U01_POSTERS_…" → songs, chants, rhymes, routines).
 */
export function materialsForDesignFile<T extends { code: string; type: string }>(
  file: string,
  materials: T[],
): T[] {
  const code = materialCodeFromDesignFile(file);
  return code ? materialsForCode(code, materials) : [];
}

/** Materials a code in a file name stands for: "ST1" → ST1, "MD" → MD1, MD2, …, "POSTERS" → songs, chants, rhymes, routines. */
export function materialsForCode<T extends { code: string; type: string }>(
  code: string,
  materials: T[],
): T[] {
  if (code.toUpperCase() === 'POSTERS')
    return materials.filter((material) => POSTER_TYPES.has(material.type));
  const exact = materials.filter((material) => material.code === code);
  if (exact.length > 0) return exact;
  if (/^[A-Z]{2}$/.test(code))
    return materials.filter((material) => new RegExp(`^${code}\\d+$`).test(material.code));
  return [];
}

const IMAGE = /\.(png|jpe?g)$/i;

/** "dragon-fruit", "Here you are" → "dragonfruit", "hereyouare" */
const letters = (value: string): string => value.toLowerCase().replaceAll(/[^a-z]/g, '');

/** 4K copies are only a fallback: the regular pictures are big enough for a TV and much lighter to download. */
const isHighResolutionCopy = (file: string): boolean => /4K/i.test(file);

/** "…_audio_v1.1.mp3" → 1001; files without a version count as 0. */
function audioVersion(file: string): number {
  const match = /_v(\d+)\.(\d+)\.[a-z0-9]+$/i.exec(path.basename(file));
  return match ? Number(match[1]) * 1000 + Number(match[2]) : 0;
}

/**
 * Decide which material or word each source file belongs to, from its name:
 * - `U05-WC-02_banana.png` → picture of word card U05-02 (only when the name matches the word)
 * - `U05_SG1_panel3_peel.jpg`, `U05_MD1_card3_….png` → picture 3 of SG1 / MD1; `U05_TS1_At-the-Market.jpg` → picture of TS1
 * - `U05_ST1_p3.png` → picture of page 3 of ST1; `U05_ST1_p0-cover.png` → its cover (picture 0); `…_p2_alt.png` is left out
 * - `U05_UC_Cover.jpg` → unit cover; `U05_PLACE_kitchen.jpg` → place picture "kitchen"
 * - `U05_SG1_…_audio_v1.0.mp3`, `LA2_RT1_…mp3` → audio of SG1 / RT1 (highest version wins)
 * - a PDF in FINAL (`U05-SG-LA….pdf`) → print file of SG1, SG2, …; a DRAFT PDF → draft layout
 */
export function planUnitMedia(sources: MediaSources): MediaPlan {
  const ignored: MediaPlan['ignored'] = [];
  const materialCodes = new Set(sources.materials.map((material) => material.code));
  const wordsByCard = new Map(sources.words.map((word) => [word.cardId, word]));

  // One file per slot; the preferred candidate wins and the others are reported.
  type Target = { link?: MaterialLink; word?: WordImage; picture?: UnitPicture; page?: PageImage };
  const slots = new Map<string, { file: string; score: number } & Target>();
  const offer = (key: string, file: string, score: number, target: Target, loserReason: string): void => {
    const current = slots.get(key);
    if (!current || score > current.score) {
      if (current) ignored.push({ file: current.file, reason: loserReason });
      slots.set(key, { file, score, ...target });
    } else {
      ignored.push({ file, reason: loserReason });
    }
  };

  const links: MaterialLink[] = [];
  sources.draftDesigns.forEach((file) => {
    const targets = materialsForDesignFile(file, sources.materials);
    if (targets.length === 0) ignored.push({ file, reason: 'no matching material' });
    for (const material of targets)
      links.push({ materialCode: material.code, role: 'draft-layout', order: 0, file });
  });

  for (const file of sources.finalFiles) {
    const name = path.basename(file);
    if (name.startsWith('.')) continue;
    if (/\.pdf$/i.test(name)) {
      const code = /^U\d+[-_]([A-Za-z]+\d*)[-_]/.exec(name)?.[1];
      const targets = code ? materialsForCode(code, sources.materials) : [];
      if (targets.length === 0) ignored.push({ file, reason: 'no matching material' });
      for (const material of targets)
        links.push({ materialCode: material.code, role: 'print', order: 0, file });
      continue;
    }
    if (!IMAGE.test(name)) {
      ignored.push({ file, reason: 'file type not used (pictures must be PNG or JPEG)' });
      continue;
    }
    const score = isHighResolutionCopy(file) ? 0 : 1;
    const card = /^U(\d+)-WC-(\d+)_(.+)\.[a-z]+$/i.exec(name);
    if (card) {
      const cardId = `U${card[1]}-${card[2]}`;
      const word = wordsByCard.get(cardId);
      if (!word) ignored.push({ file, reason: `no word card ${cardId}` });
      else if (letters(word.text) !== letters(card[3]!))
        ignored.push({ file, reason: `word card ${cardId} is "${word.text}"` });
      else
        offer(
          `word:${cardId}`,
          file,
          score,
          { word: { cardId, file } },
          `a lighter copy is used for word card ${cardId}`,
        );
      continue;
    }
    if (/^U\d+_UC_/i.test(name)) {
      offer(
        'cover',
        file,
        score,
        { picture: { role: 'cover', label: '', order: 0, file } },
        'a lighter copy is used for the unit cover',
      );
      continue;
    }
    const place = /^U\d+_PLACE_(.+)\.[a-z]+$/i.exec(name);
    if (place) {
      const label = place[1]!.replaceAll(/[-_]+/g, ' ').trim().toLowerCase();
      offer(
        `place:${label}`,
        file,
        score,
        { picture: { role: 'place', label, order: 0, file } },
        `a lighter copy is used for the place "${label}"`,
      );
      continue;
    }
    const picture = /^U\d+_([A-Z]+\d*)_(.*)$/i.exec(name);
    const code = picture?.[1]?.toUpperCase();
    if (!code || !materialCodes.has(code)) {
      ignored.push({ file, reason: 'no matching material or word card' });
      continue;
    }
    const rest = picture![2]!;
    if (/^p\d+_alt\b/i.test(rest)) {
      ignored.push({ file, reason: 'alternative picture' });
      continue;
    }
    const page = Number(/^p(\d+)(?=[-_.])/i.exec(rest)?.[1] ?? 0);
    if (page > 0) {
      offer(
        `page:${code}:${page}`,
        file,
        score,
        { page: { materialCode: code, number: page, file } },
        `a lighter copy is used for ${code} page ${page}`,
      );
      continue;
    }
    const order = Number(/^(?:panel|card)(\d+)/i.exec(rest)?.[1] ?? 0);
    offer(
      `poster:${code}:${order}`,
      file,
      score,
      { link: { materialCode: code, role: 'poster', order, file } },
      `a lighter copy is used for ${code}`,
    );
  }

  for (const file of sources.audio) {
    const name = path.basename(file);
    if (!/\.mp3$/i.test(name)) continue;
    const code = /^(?:U\d+|LA\d*)_([A-Z]+\d+)_/i.exec(name)?.[1]?.toUpperCase();
    if (!code || !materialCodes.has(code)) {
      // Program-wide audio (routines) only applies to units that have that material.
      if (!/^LA\d*_/i.test(name)) ignored.push({ file, reason: 'no matching material' });
      continue;
    }
    offer(
      `audio:${code}`,
      file,
      audioVersion(file),
      { link: { materialCode: code, role: 'audio', order: 0, file } },
      `a newer version is used for ${code}`,
    );
  }

  const words: WordImage[] = [];
  const pictures: UnitPicture[] = [];
  const pages: PageImage[] = [];
  for (const slot of slots.values()) {
    if (slot.link) links.push(slot.link);
    if (slot.page) pages.push(slot.page);
    if (slot.word) words.push(slot.word);
    if (slot.picture) pictures.push(slot.picture);
  }
  // Places in name order, so the teacher sees them in a stable order.
  pictures
    .filter((picture) => picture.role === 'place')
    .sort((a, b) => a.label.localeCompare(b.label))
    .forEach((picture, index) => (picture.order = index));
  return { links, words, pictures, pages, ignored };
}
