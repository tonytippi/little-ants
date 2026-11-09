import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  discoverCharacterArt,
  discoverProgramAudio,
  discoverUnit,
  discoverUnitFolders,
  importReads,
  unitNumber,
} from '../src/discover.js';

/** Create empty files below `root`. */
function touch(root: string, files: string[]): void {
  for (const file of files) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), '');
  }
}

describe('unit folders', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'la-discover-'));
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('reads the unit number from spec, media and older folder names', () => {
    expect(unitNumber('U01_HelloLittleAnts')).toBe(1);
    expect(unitNumber('U12')).toBe(12);
    expect(unitNumber('Unit05_YummyGarden')).toBe(5);
    expect(unitNumber('Unit 1_Hello Little Ants_')).toBe(1);
    expect(unitNumber('01_BRAND')).toBeNull();
    expect(unitNumber('UC')).toBeNull();
  });

  it('lists the unit spec folders in 10_SPEC in number order and ignores files and other folders', () => {
    for (const name of ['U10_PeopleWhoHelp', 'U02_ThisIsMe', 'U03_MyAntHillSchool', '_tmp'])
      mkdirSync(path.join(root, '10_SPEC', name), { recursive: true });
    touch(root, ['10_SPEC/U99_notes.md']);
    expect(discoverUnitFolders(root).map((folder) => path.basename(folder))).toEqual([
      'U02_ThisIsMe',
      'U03_MyAntHillSchool',
      'U10_PeopleWhoHelp',
    ]);
  });

  it('is empty when there is no 10_SPEC folder', () => {
    expect(discoverUnitFolders(path.join(root, 'missing'))).toEqual([]);
  });
});

describe('unit files', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'la-unit-files-'));
  afterAll(() => rmSync(root, { recursive: true, force: true }));
  touch(root, [
    '10_SPEC/U05_YummyGarden/U05_MASTER-SHEET.xlsx',
    '10_SPEC/U05_YummyGarden/U05_Content-Texts.md',
    '10_SPEC/U05_YummyGarden/Lesson-Plans/U05_Lesson-Plans_L01-40.docx',
    '10_SPEC/U05_YummyGarden/Lesson-Plans/~$U05_Lesson-Plans_L01-40.docx',
    '20_PICTURES/U05/03_Word-Cards/U05-WC-02_banana.png',
    '20_PICTURES/U05/07_Stories/U05_ST1_p1.png',
    '20_PICTURES/U50/03_Word-Cards/U50-WC-01_other.png',
    '40_PDF/U05/U05_SG1_In-Our-Yummy-Garden.pdf',
    '40_PDF/U05/00. U05_Print-Order.xlsx',
    '40_PDF/U05/older-versions/U05_SG1_old.pdf',
    '50_AUDIO/U05/U05_SG1_In-Our-Yummy-Garden_audio_v1.0.mp3',
    '50_AUDIO/U05/U05_CH1_timing.json',
    '50_AUDIO/U05/WordCards/U05-WC-02_banana.mp3',
    '50_AUDIO/00_Routines/LA2_RT1_Hello-Little-Ants_audio_v1.0.mp3',
    '50_AUDIO/00_Voices/LA_Annie/sample.mp3',
  ]);
  const rel = (files: string[]): string[] => files.map((file) => path.relative(root, file)).sort();

  it('finds the spec files and the unit folders in the picture, PDF and audio trees', () => {
    const unit = discoverUnit(root, path.join(root, '10_SPEC', 'U05_YummyGarden'));
    expect(rel([unit.masterSheet, unit.contentTexts!, unit.lessonPlans!])).toEqual([
      '10_SPEC/U05_YummyGarden/Lesson-Plans/U05_Lesson-Plans_L01-40.docx',
      '10_SPEC/U05_YummyGarden/U05_Content-Texts.md',
      '10_SPEC/U05_YummyGarden/U05_MASTER-SHEET.xlsx',
    ]);
    expect(rel(unit.pictures)).toEqual([
      '20_PICTURES/U05/03_Word-Cards/U05-WC-02_banana.png',
      '20_PICTURES/U05/07_Stories/U05_ST1_p1.png',
    ]);
    expect(rel(unit.printFiles)).toEqual(['40_PDF/U05/U05_SG1_In-Our-Yummy-Garden.pdf']);
    expect(rel(unit.audio)).toEqual(['50_AUDIO/U05/U05_SG1_In-Our-Yummy-Garden_audio_v1.0.mp3']);
    expect(rel(discoverProgramAudio(root))).toEqual([
      '50_AUDIO/00_Routines/LA2_RT1_Hello-Little-Ants_audio_v1.0.mp3',
    ]);
  });

  it('copes with a unit that has no pictures, PDFs or audio yet', () => {
    touch(root, ['10_SPEC/U12_BigAntsGrowUp/U12_MASTER-SHEET.xlsx']);
    const unit = discoverUnit(root, path.join(root, '10_SPEC', 'U12_BigAntsGrowUp'));
    expect(unit).toMatchObject({ contentTexts: null, lessonPlans: null, pictures: [], printFiles: [], audio: [] });
  });

  it('needs a master sheet', () => {
    mkdirSync(path.join(root, '10_SPEC', 'U11_HelloVietnam'), { recursive: true });
    expect(() => discoverUnit(root, path.join(root, '10_SPEC', 'U11_HelloVietnam'))).toThrow('MASTER-SHEET');
  });
});

describe('what the Drive sync mirrors', () => {
  it('takes unit specs, pictures, print PDFs, recordings and character art', () => {
    expect(importReads('10_SPEC', true)).toBe(true);
    expect(importReads('10_SPEC/U05_YummyGarden/Lesson-Plans/U05_Lesson-Plans_L01-40.docx', false)).toBe(true);
    expect(importReads('20_PICTURES/U05/07_Stories/U05_ST1_p1.png', false)).toBe(true);
    expect(importReads('40_PDF/U05', true)).toBe(true);
    expect(importReads('40_PDF/U05/U05_SG1_In-Our-Yummy-Garden.pdf', false)).toBe(true);
    expect(importReads('50_AUDIO/00_Routines/LA2_RT1_Hello.mp3', false)).toBe(true);
    expect(importReads('01_BRAND', true)).toBe(true);
    expect(importReads('01_BRAND/Characters/v2_FINAL/front/CHAR_01_Annie_front_v2.png', false)).toBe(true);
  });

  it('leaves out everything else', () => {
    expect(importReads('10_SPEC/U05_YummyGarden/_REFERENCES', true)).toBe(false);
    expect(importReads('30_HTML', true)).toBe(false);
    expect(importReads('README.md', false)).toBe(false);
    expect(importReads('40_PDF/U05/older-versions', true)).toBe(false);
    expect(importReads('40_PDF/U05_index.pdf', false)).toBe(false);
    expect(importReads('50_AUDIO/U05/_parts', true)).toBe(false);
    expect(importReads('50_AUDIO/U05/WordCards/U05-WC-02_banana.mp3', false)).toBe(false);
    expect(importReads('01_BRAND/Logo', true)).toBe(false);
    expect(importReads('01_BRAND/README.md', false)).toBe(false);
  });
});

describe('character art', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'la-characters-'));
  afterAll(() => rmSync(root, { recursive: true, force: true }));
  const characters = path.join(root, '01_BRAND', 'Characters');
  const addArt = (folder: string, names: string[]): void => {
    mkdirSync(path.join(characters, folder), { recursive: true });
    for (const name of names) writeFileSync(path.join(characters, folder, name), '');
  };
  const artNames = (): string[] =>
    discoverCharacterArt(root)
      .map((file) => path.relative(characters, file))
      .sort();

  it('is empty when there is no finished-art folder', () => {
    expect(discoverCharacterArt(root)).toEqual([]);
    addArt('DRAFT', ['CHAR_01_Annie.png']);
    expect(discoverCharacterArt(root)).toEqual([]);
  });

  it('reads CHAR_*.png from FINAL', () => {
    addArt('FINAL', ['CHAR_01_Annie.png', 'CHAR_02_Tiny-Ant.PNG', 'notes.txt', 'Annie.png']);
    expect(artNames()).toEqual([
      path.join('FINAL', 'CHAR_01_Annie.png'),
      path.join('FINAL', 'CHAR_02_Tiny-Ant.PNG'),
    ]);
  });

  it('prefers the highest v<N>_FINAL folder', () => {
    addArt('v2_FINAL', ['CHAR_01_Annie.png']);
    expect(artNames()).toEqual([path.join('v2_FINAL', 'CHAR_01_Annie.png')]);
    addArt('v10_FINAL', ['CHAR_05_Grandma.png']);
    expect(artNames()).toEqual([path.join('v10_FINAL', 'CHAR_05_Grandma.png')]);
  });

  it('finds art in subfolders and skips character sheets', () => {
    addArt(path.join('v11_FINAL', 'front'), [
      'CHAR_01_Annie_front_v2.png',
      'CHAR_12b_Pip-Butterfly_front_v2.png',
    ]);
    addArt(path.join('v11_FINAL', 'sheets'), ['CHAR-SHEET_01_Annie_v2.png']);
    addArt('v11_FINAL', ['LA2_v2_ALL-CHARACTERS_front-grid.png']);
    expect(artNames()).toEqual([
      path.join('v11_FINAL', 'front', 'CHAR_01_Annie_front_v2.png'),
      path.join('v11_FINAL', 'front', 'CHAR_12b_Pip-Butterfly_front_v2.png'),
    ]);
  });
});
