import type { ReleaseMaterial, ReleaseMedia, ReleaseStep, UnitReleasePayload } from '@little-ants/shared';
import type { StageView } from '../../lib/presenter';

/** The parts of a material children see. Teacher-only text (notes, actions) stays off the TV. */
export type StageMaterial = Pick<
  ReleaseMaterial,
  'code' | 'title' | 'fullText' | 'targetLanguage' | 'pages' | 'media'
>;

/**
 * Everything the stage shows at one moment, self-contained so a TV can render it without the release:
 * the teacher window, the TV window and the Cast receiver all draw from the same frame.
 */
export interface StageFrame {
  title: string;
  stepTitle: string;
  view: StageView;
  page: number;
  material: StageMaterial | null;
  /** The word card on screen in the word cards view. */
  word: { text: string; image: ReleaseMedia | null } | null;
  wordCount: number;
  lead: { name: string; image: ReleaseMedia | null } | null;
}

/** What the stage shows for a material, in order of preference. */
export type MaterialDisplay =
  | { kind: 'pages'; pages: { text: string; image: ReleaseMedia | null }[]; pdf: ReleaseMedia | null }
  | { kind: 'images'; images: ReleaseMedia[] }
  | { kind: 'pdf'; pdf: ReleaseMedia }
  | { kind: 'text'; text: string };

export function materialDisplay(material: StageMaterial): MaterialDisplay {
  const images = material.media.filter((media) => media.kind === 'IMAGE' && media.role !== 'draft-layout');
  const pdf = material.media.find((media) => media.kind === 'PDF') ?? null;
  if (material.pages.length > 0) {
    return {
      kind: 'pages',
      pages: material.pages.map((page) => ({ text: page.text, image: page.image })),
      pdf,
    };
  }
  if (images.length > 0) return { kind: 'images', images };
  if (pdf) return { kind: 'pdf', pdf };
  return { kind: 'text', text: material.fullText || material.targetLanguage || material.title };
}

/** Pages the teacher can turn through (a PDF reports its own count once loaded). */
export function displayPageCount(display: MaterialDisplay, pdfPages: number | null): number {
  switch (display.kind) {
    case 'pages':
      return display.pages.length;
    case 'images':
      return display.images.length;
    case 'pdf':
      return pdfPages ?? 1;
    case 'text':
      return 1;
  }
}

/** Audio for the current material and page: the page's own audio first, then the material's tracks. */
export function audioFor(material: StageMaterial | null | undefined, page: number): ReleaseMedia[] {
  if (!material) return [];
  const pageAudio = material.pages[page]?.audio;
  const tracks = material.media.filter((media) => media.kind === 'AUDIO');
  return pageAudio ? [pageAudio, ...tracks] : tracks;
}

export function materialForStep(
  payload: UnitReleasePayload,
  step: ReleaseStep | undefined,
): ReleaseMaterial | undefined {
  if (!step?.materialCode) return undefined;
  return payload.materials.find((material) => material.code === step.materialCode);
}

export function clampPage(page: number, count: number): number {
  return Math.min(Math.max(0, page), Math.max(0, count - 1));
}

/**
 * PDF page (1-based) for a story page (0-based). Draft layout PDFs may start with extra pages
 * (a cover), so when the PDF is longer than the story, the story ends on the last PDF page.
 */
export function pdfPageForStoryPage(page: number, storyPages: number, pdfPages: number | null): number {
  const offset = pdfPages && pdfPages > storyPages ? pdfPages - storyPages : 0;
  return page + 1 + offset;
}

/** Word cards shown in class (extra words are for home only). */
export function stageWords(payload: UnitReleasePayload) {
  return payload.words.filter((word) => word.kind !== 'EXTRA');
}

export function buildStageFrame(
  payload: UnitReleasePayload,
  step: ReleaseStep | undefined,
  view: StageView,
  page: number,
): StageFrame {
  const found = materialForStep(payload, step);
  const material: StageMaterial | null = found
    ? {
        code: found.code,
        title: found.title,
        fullText: found.fullText,
        targetLanguage: found.targetLanguage,
        pages: found.pages,
        media: found.media,
      }
    : null;
  const words = stageWords(payload);
  const word = view === 'words' ? words[clampPage(page, words.length)] : undefined;
  const lead = payload.unit.leadCharacter;
  return {
    title: view === 'words' ? 'Word cards' : (material?.title ?? step?.title ?? payload.unit.title),
    stepTitle: step?.title ?? 'Little Ants',
    view,
    page,
    material: view === 'material' ? material : null,
    word: word ? { text: word.text, image: word.image } : null,
    wordCount: words.length,
    lead: lead ? { name: lead.name, image: lead.image } : null,
  };
}
