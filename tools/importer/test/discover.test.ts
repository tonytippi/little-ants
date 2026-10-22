import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { discoverUnitFolders, unitNumber } from '../src/discover.js';

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
