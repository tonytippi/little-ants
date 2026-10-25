import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { discoverCharacterArt, discoverUnitFolders, unitNumber } from '../src/discover.js';

describe('unit folders', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'la-discover-'));
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('reads the unit number from old and new folder names', () => {
    expect(unitNumber('Unit 1_Hello Little Ants_')).toBe(1);
    expect(unitNumber('Unit01_HelloLittleAnts')).toBe(1);
    expect(unitNumber('Unit12_BigAntsGrowUp')).toBe(12);
    expect(unitNumber('01_BRAND')).toBeNull();
  });

  it('lists unit folders in number order and ignores files and other folders', () => {
    for (const name of ['Unit10_PeopleWhoHelp', 'Unit02_ThisIsMe', 'Unit 3_My Ant Hill', '01_BRAND'])
      mkdirSync(path.join(root, name));
    writeFileSync(path.join(root, 'Unit99_notes.docx'), '');
    expect(discoverUnitFolders(root).map((folder) => path.basename(folder))).toEqual([
      'Unit02_ThisIsMe',
      'Unit 3_My Ant Hill',
      'Unit10_PeopleWhoHelp',
    ]);
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
});
