import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

export interface UnitFiles {
  folder: string;
  masterSheet: string;
  lessonPlans: string | null;
  contentTexts: string | null;
  draftDesigns: string[];
}

function isOfficeLockOrJunk(name: string): boolean {
  return name.startsWith('~$') || name.startsWith('.') || name.endsWith('.DS_Store');
}

function listFiles(dir: string, depth = 3): string[] {
  if (depth < 0) return [];
  const result: string[] = [];
  for (const name of readdirSync(dir)) {
    if (isOfficeLockOrJunk(name)) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) result.push(...listFiles(full, depth - 1));
    else result.push(full);
  }
  return result;
}

/** Find a unit's source files by name pattern; folder names vary ("03_Content_" vs "03_Content"). */
export function discoverUnit(folder: string): UnitFiles {
  const files = listFiles(folder);
  const masterSheet = files.find((file) => /_MASTER-SHEET\.xlsx$/i.test(file));
  if (!masterSheet) {
    throw new Error(`No *_MASTER-SHEET.xlsx in ${folder}`);
  }
  return {
    folder,
    masterSheet,
    lessonPlans: files.find((file) => /Lesson-Plans_L01-40.*\.docx$/i.test(file)) ?? null,
    contentTexts: files.find((file) => /Content-Texts.*\.docx$/i.test(file)) ?? null,
    draftDesigns: files.filter((file) => /[/\\]04_Design[^/\\]*[/\\]DRAFT[^/\\]*[/\\].+\.pdf$/i.test(file)),
  };
}

/** Unit number from a unit folder name: "Unit 1_Hello Little Ants_" and "Unit01_HelloLittleAnts" both give 1. */
export function unitNumber(folderName: string): number | null {
  const match = /^Unit\s*(\d+)/i.exec(folderName);
  return match ? Number(match[1]) : null;
}

/** Unit folders under the LA 3-6 program folder, sorted by number. */
export function discoverUnitFolders(programFolder: string): string[] {
  return readdirSync(programFolder, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && unitNumber(entry.name) !== null)
    .map((entry) => entry.name)
    .sort((a, b) => unitNumber(a)! - unitNumber(b)!)
    .map((name) => path.join(programFolder, name));
}
