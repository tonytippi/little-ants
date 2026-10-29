import { describe, expect, it } from 'vitest';
import type { ReleaseMaterial, ReleaseMedia, ReleaseStep, UnitReleasePayload } from '@little-ants/shared';
import {
  audioFor,
  buildStageFrame,
  clampPage,
  displayPageCount,
  materialDisplay,
  pdfPageForStoryPage,
} from '../src/components/player/stage-content';
import { formatBytes, formatClock } from '../src/lib/format';
import { downloadState } from '../src/lib/release-diff';

const media = (id: string, kind: ReleaseMedia['kind']): ReleaseMedia => ({
  id,
  kind,
  mimeType: '',
  url: `https://m/${id}`,
  sizeBytes: 1,
  fileName: id,
});

const material = (overrides: Partial<ReleaseMaterial> = {}): ReleaseMaterial => ({
  code: 'SG1',
  type: 'SONG',
  title: 'Hello',
  format: '',
  targetLanguage: '',
  fullText: 'Hello, hello!',
  actions: '',
  teacherNotes: '',
  pages: [],
  media: [],
  ...overrides,
});

describe('formatClock and formatBytes', () => {
  it('formats timers, including overtime', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(125)).toBe('2:05');
    expect(formatClock(-30)).toBe('-0:30');
  });

  it('formats sizes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(5_400_000)).toBe('5.1 MB');
  });
});

describe('downloadState', () => {
  it('compares the device copy with the latest release', () => {
    expect(downloadState(undefined, 2)).toEqual({ kind: 'not-downloaded' });
    expect(downloadState(1, 2)).toEqual({ kind: 'update-available', local: 1, latest: 2 });
    expect(downloadState(2, 2)).toEqual({ kind: 'up-to-date', version: 2 });
    expect(downloadState(undefined, undefined)).toEqual({ kind: 'not-published' });
    expect(downloadState(3, undefined)).toEqual({ kind: 'up-to-date', version: 3 });
  });
});

describe('materialDisplay', () => {
  it('prefers pages, then poster images, then a draft PDF, then the text', () => {
    const story = material({ type: 'STORY', pages: [{ number: 1, text: 'Hi', image: null, audio: null }] });
    expect(materialDisplay(story).kind).toBe('pages');
    const poster = material({
      media: [
        { ...media('p', 'IMAGE'), role: 'poster' },
        { ...media('d', 'PDF'), role: 'draft-layout' },
      ],
    });
    expect(materialDisplay(poster).kind).toBe('images');
    const draft = material({ media: [{ ...media('d', 'PDF'), role: 'draft-layout' }] });
    expect(materialDisplay(draft)).toMatchObject({ kind: 'pdf' });
    expect(materialDisplay(material())).toEqual({ kind: 'text', text: 'Hello, hello!' });
  });

  it('counts pages for turning', () => {
    expect(displayPageCount(materialDisplay(material()), null)).toBe(1);
    expect(displayPageCount({ kind: 'pdf', pdf: media('d', 'PDF') }, 6)).toBe(6);
    expect(clampPage(9, 3)).toBe(2);
    expect(clampPage(-1, 3)).toBe(0);
  });

  it('plays the page audio before the material tracks', () => {
    const story = material({
      pages: [{ number: 1, text: 'Hi', image: null, audio: media('page1', 'AUDIO') }],
      media: [{ ...media('song', 'AUDIO'), role: 'audio' }],
    });
    expect(audioFor(story, 0).map((item) => item.id)).toEqual(['page1', 'song']);
    expect(audioFor(story, 1).map((item) => item.id)).toEqual(['song']);
    expect(audioFor(undefined, 0)).toEqual([]);
  });
});

describe('pdfPageForStoryPage', () => {
  it('skips a cover page in draft layout PDFs', () => {
    expect(pdfPageForStoryPage(0, 8, 9)).toBe(2);
    expect(pdfPageForStoryPage(7, 8, 9)).toBe(9);
  });

  it('maps one to one when the PDF matches the story or is still loading', () => {
    expect(pdfPageForStoryPage(0, 8, 8)).toBe(1);
    expect(pdfPageForStoryPage(2, 8, null)).toBe(3);
    expect(pdfPageForStoryPage(2, 8, 4)).toBe(3);
  });
});

describe('buildStageFrame', () => {
  const step = (materialCode: string | null): ReleaseStep => ({
    order: 1,
    minutes: 5,
    kind: 'SONG',
    title: 'Sing hello',
    materialCode,
    teacherText: 'Point and sing.',
    childrenText: 'Sing along.',
  });
  const longStory = material({
    code: 'ST1',
    type: 'STORY',
    title: 'The big day',
    actions: 'Clap twice.',
    teacherNotes: 'Pause before the last page.',
    pages: Array.from({ length: 40 }, (_, i) => ({
      number: i + 1,
      text: 'Ants walk to the garden and look for food under the big green leaves. '.repeat(4),
      image: media(`page-${i}`, 'IMAGE'),
      audio: media(`audio-${i}`, 'AUDIO'),
    })),
  });
  const payload = {
    unit: { title: 'My Home', leadCharacter: { code: 'ANT', name: 'Andy', image: media('andy', 'IMAGE') } },
    words: [
      { cardId: 'w1', text: 'cat', kind: 'CORE', group: '', image: media('cat', 'IMAGE') },
      { cardId: 'w2', text: 'extra', kind: 'EXTRA', group: '', image: null },
      { cardId: 'w3', text: 'dog', kind: 'CORE', group: '', image: null },
    ],
    materials: [material(), longStory],
  } as unknown as UnitReleasePayload;

  it('carries the material children see without teacher-only text', () => {
    const frame = buildStageFrame(payload, step('ST1'), 'material', 2);
    expect(frame).toMatchObject({ title: 'The big day', view: 'material', page: 2, word: null });
    expect(frame.material?.pages).toHaveLength(40);
    expect(frame.material).not.toHaveProperty('teacherNotes');
    expect(frame.material).not.toHaveProperty('actions');
    expect(JSON.stringify(frame)).not.toContain('Pause before the last page');
  });

  it('shows the current class word card, skipping home-only words', () => {
    const frame = buildStageFrame(payload, step('SG1'), 'words', 1);
    expect(frame).toMatchObject({ title: 'Word cards', material: null, wordCount: 2 });
    expect(frame.word).toEqual({ text: 'dog', image: null });
  });

  it('falls back to the step card with the lead character', () => {
    const frame = buildStageFrame(payload, step(null), 'material', 0);
    expect(frame).toMatchObject({ title: 'Sing hello', stepTitle: 'Sing hello', material: null });
    expect(frame.lead?.name).toBe('Andy');
  });

  it('stays small enough for one Cast message', () => {
    for (const code of ['SG1', 'ST1']) {
      const frame = buildStageFrame(payload, step(code), 'material', 0);
      expect(JSON.stringify(frame).length).toBeLessThan(32_000);
    }
  });
});
