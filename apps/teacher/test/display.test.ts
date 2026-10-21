import { describe, expect, it } from 'vitest';
import type { ReleaseMaterial, ReleaseMedia } from '@little-ants/shared';
import {
  audioFor,
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
