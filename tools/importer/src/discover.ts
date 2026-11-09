import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Program folder ("LA 3-6") layout: each kind of file has one top folder, split by unit.
 *   10_SPEC/U05_YummyGarden/   master sheet, lesson plans, content texts (Markdown)
 *   20_PICTURES/U05/<step>/    finished pictures (PNG)
 *   40_PDF/U05/                print PDFs (subfolders are older versions and the student book)
 *   50_AUDIO/U05/              recordings; 50_AUDIO/00_Routines/ holds the routine songs of every unit
 *   01_BRAND/Characters/       character art
 */
export const SPEC_FOLDER = '10_SPEC';
export const PICTURES_FOLDER = '20_PICTURES';
export const PDF_FOLDER = '40_PDF';
export const AUDIO_FOLDER = '50_AUDIO';
export const ROUTINES_AUDIO_FOLDER = '00_Routines';
export const BRAND_FOLDER = '01_BRAND';

export interface UnitFiles {
  /** The unit's spec folder, 10_SPEC/UNN_Name. */
  folder: string;
  masterSheet: string;
  lessonPlans: string | null;
  contentTexts: string | null;
  /** Everything under 20_PICTURES/UNN. */
  pictures: string[];
  /** Files directly in 40_PDF/UNN. */
  printFiles: string[];
  /** Recordings directly in 50_AUDIO/UNN (page and word recordings in subfolders are not used). */
  audio: string[];
}

function isOfficeLockOrJunk(name: string): boolean {
  return name.startsWith('~$') || name.startsWith('.') || name.endsWith('.DS_Store');
}

/** Files below `dir`, `depth` levels of subfolders deep (0: only files directly in it); empty when it is missing. */
function listFiles(dir: string, depth = 6): string[] {
  if (depth < 0 || !existsSync(dir)) return [];
  const result: string[] = [];
  for (const name of readdirSync(dir)) {
    if (isOfficeLockOrJunk(name)) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) result.push(...listFiles(full, depth - 1));
    else result.push(full);
  }
  return result;
}

/** Unit number from a unit folder name: "U05_YummyGarden", "U05" and the older "Unit05_YummyGarden" give 5. */
export function unitNumber(folderName: string): number | null {
  const match = /^U(?:nit)?\s*(\d+)/i.exec(folderName);
  return match ? Number(match[1]) : null;
}

/** "U05": the name of a unit's folder under 20_PICTURES, 40_PDF and 50_AUDIO. */
export function unitCode(number: number): string {
  return `U${String(number).padStart(2, '0')}`;
}

/** Find a unit's source files: its spec folder (10_SPEC/UNN_Name) and its folders in the picture, PDF and audio trees. */
export function discoverUnit(programFolder: string, specFolder: string): UnitFiles {
  const number = unitNumber(path.basename(specFolder));
  if (number === null) throw new Error(`Not a unit folder: ${specFolder}`);
  const files = listFiles(specFolder);
  const masterSheet = files.find((file) => /_MASTER-SHEET\.xlsx$/i.test(file));
  if (!masterSheet) {
    throw new Error(`No *_MASTER-SHEET.xlsx in ${specFolder}`);
  }
  const code = unitCode(number);
  return {
    folder: specFolder,
    masterSheet,
    lessonPlans: files.find((file) => /Lesson-Plans_L01-40.*\.docx$/i.test(file)) ?? null,
    contentTexts: files.find((file) => /Content-Texts.*\.md$/i.test(file)) ?? null,
    pictures: listFiles(path.join(programFolder, PICTURES_FOLDER, code)),
    printFiles: listFiles(path.join(programFolder, PDF_FOLDER, code), 0).filter((file) => /\.pdf$/i.test(file)),
    audio: listFiles(path.join(programFolder, AUDIO_FOLDER, code), 0).filter((file) => /\.mp3$/i.test(file)),
  };
}

/** Unit spec folders under 10_SPEC, sorted by number. */
export function discoverUnitFolders(programFolder: string): string[] {
  const specs = path.join(programFolder, SPEC_FOLDER);
  if (!existsSync(specs)) return [];
  return readdirSync(specs, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && unitNumber(entry.name) !== null)
    .map((entry) => entry.name)
    .sort((a, b) => unitNumber(a)! - unitNumber(b)!)
    .map((name) => path.join(specs, name));
}

/** Recordings shared by every unit: the routine songs in 50_AUDIO/00_Routines. */
export function discoverProgramAudio(programFolder: string): string[] {
  return listFiles(path.join(programFolder, AUDIO_FOLDER, ROUTINES_AUDIO_FOLDER), 0).filter((file) =>
    /\.mp3$/i.test(file),
  );
}

/**
 * Whether the import reads a Drive item ("/"-separated path below the program folder), so the sync only mirrors
 * those: the unit specs (not their copies of the character sheets), all pictures, the files directly in each
 * 40_PDF and 50_AUDIO subfolder (not older versions, voice samples or recording parts) and the character art.
 */
export function importReads(relative: string, isFolder: boolean): boolean {
  const parts = relative.split('/');
  switch (parts[0]) {
    case SPEC_FOLDER:
      return !parts.includes('_REFERENCES');
    case PICTURES_FOLDER:
      return true;
    case PDF_FOLDER:
    case AUDIO_FOLDER:
      return isFolder ? parts.length <= 2 : parts.length === 3;
    case BRAND_FOLDER:
      return parts.length === 1 ? isFolder : parts[1] === 'Characters';
    default:
      return false;
  }
}

/** Version of a finished-art folder: "FINAL" is 1, "v2_FINAL" is 2; null for other folders. */
function finalFolderVersion(name: string): number | null {
  const match = /^(?:v(\d+)_)?FINAL$/i.exec(name);
  return match ? Number(match[1] ?? 1) : null;
}

/**
 * Character art (CHAR_*.png) anywhere in the newest 01_BRAND/Characters/(v<N>_)FINAL folder,
 * e.g. v2_FINAL/front/CHAR_01_Annie_front_v2.png; empty when there is none.
 */
export function discoverCharacterArt(programFolder: string): string[] {
  const charactersFolder = path.join(programFolder, BRAND_FOLDER, 'Characters');
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
  return listFiles(path.join(charactersFolder, newest.name), 2).filter((file) =>
    /^CHAR_.*\.png$/i.test(path.basename(file)),
  );
}
