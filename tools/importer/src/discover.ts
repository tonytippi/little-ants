import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

export interface UnitFiles {
  folder: string;
  masterSheet: string;
  lessonPlans: string | null;
  contentTexts: string | null;
  draftDesigns: string[];
  /** Everything under 04_Design/FINAL (finished pictures and print files). */
  finalFiles: string[];
  /** Recordings under 05_Audio-Video. */
  audio: string[];
}

function isOfficeLockOrJunk(name: string): boolean {
  return name.startsWith('~$') || name.startsWith('.') || name.endsWith('.DS_Store');
}

function listFiles(dir: string, depth = 6): string[] {
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
    finalFiles: files.filter((file) => /[/\\]04_Design[^/\\]*[/\\]FINAL[^/\\]*[/\\]/i.test(file)),
    audio: files.filter((file) => /[/\\]05_Audio[^/\\]*[/\\].+\.mp3$/i.test(file)),
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

/** Recordings shared by every unit, e.g. the routine songs in "00_ROUTINES-AUDIO". */
export function discoverProgramAudio(programFolder: string): string[] {
  return readdirSync(programFolder, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /AUDIO/i.test(entry.name) && unitNumber(entry.name) === null)
    .flatMap((entry) => listFiles(path.join(programFolder, entry.name), 2))
    .filter((file) => /\.mp3$/i.test(file));
}

/** Version of a finished-art folder: "FINAL" is 1, "v2_FINAL" is 2; null for other folders. */
function finalFolderVersion(name: string): number | null {
  const match = /^(?:v(\d+)_)?FINAL$/i.exec(name);
  return match ? Number(match[1] ?? 1) : null;
}

/** Character art (CHAR_*.png) in the newest 01_BRAND/Characters/(v<N>_)FINAL folder; empty when there is none. */
export function discoverCharacterArt(programFolder: string): string[] {
  const charactersFolder = path.join(programFolder, '01_BRAND', 'Characters');
  let entries;
  try {
    entries = readdirSync(charactersFolder, { withFileTypes: true });
  } catch {
    return [];
  }
  const newest = entries
    .filter((entry) => entry.isDirectory() && finalFolderVersion(entry.name) !== null)
    .sort((a, b) => finalFolderVersion(b.name)! - finalFolderVersion(a.name)!)[0];
  if (!newest) return [];
  const artFolder = path.join(charactersFolder, newest.name);
  return readdirSync(artFolder)
    .filter((name) => /^CHAR_.*\.png$/i.test(name))
    .map((name) => path.join(artFolder, name));
}
