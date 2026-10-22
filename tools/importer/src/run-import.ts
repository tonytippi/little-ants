import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { backupDatabase } from '@little-ants/db/backup';
import { createPrismaClient } from '@little-ants/db';
import type { LevelRules } from '@little-ants/shared';
import { createStorageFromEnv, type ObjectStorage } from '@little-ants/storage';
import { importCharacterArt, importDraftDesigns } from './assets.js';
import { discoverUnit, discoverUnitFolders, unitNumber } from './discover.js';
import { DriveClient, downloadFolder, driveAuthFromEnv, findProgramFolder } from './drive.js';
import { parseUnit } from './parse-unit.js';
import { renderReport, type UnitReport } from './report.js';
import { archivePrefix, archiveSources, sourceSummary } from './source-archive.js';
import { hasManualEdits, writeUnit } from './write-unit.js';

export const repoRoot = path.resolve(import.meta.dirname, '../../..');

export interface ImportOptions {
  /** Read the source files from Google Drive (GOOGLE_DRIVE_FOLDER_ID) instead of `source`. */
  drive: boolean;
  /** Local program folder; defaults to docs/Little Ants English/LA 3-6. */
  source?: string;
  /** Unit numbers to import, or "all". */
  units: number[] | 'all';
  dryRun: boolean;
  /** Upload draft layouts and character art. */
  assets: boolean;
  /** Overwrite units edited in Admin. */
  force: boolean;
  /** Progress lines. */
  log?: (message: string) => void;
}

export interface ImportResult {
  startedAt: Date;
  /** Markdown report. */
  report: string;
  /** Storage prefix of the archived Drive files (Drive runs that write). */
  archive: string | null;
}

/** Parse the Master Sheets and Word files, write them to the database and upload their files. */
export async function runImport(options: ImportOptions): Promise<ImportResult> {
  const log = options.log ?? ((message: string) => console.log(message));
  const startedAt = new Date();
  const storage = !options.dryRun && (options.assets || options.drive) ? createStorageFromEnv(process.env, repoRoot) : null;
  const download = options.drive ? await downloadFromDrive(startedAt, storage, log) : null;
  try {
    const sourceFolder = download?.folder ?? path.resolve(options.source ?? path.join(repoRoot, 'docs', 'Little Ants English', 'LA 3-6'));
    const reports = await importUnits(options, sourceFolder, options.assets ? storage : null, log);
    const report = renderReport(reports, { dryRun: options.dryRun, startedAt, source: download?.summary ?? [] });
    if (download?.archive && storage) {
      await storage.put(`${download.archive}/report.md`, new TextEncoder().encode(report), 'text/markdown');
    }
    return { startedAt, report, archive: download?.archive ?? null };
  } finally {
    if (download) rmSync(download.root, { recursive: true, force: true });
  }
}

/** Earlier downloads, so repeated runs only fetch files that changed on Drive (Google limits bursts of downloads). */
function driveCacheDir(): string {
  return path.resolve(process.env.GOOGLE_DRIVE_CACHE_DIR?.trim() || path.join(repoRoot, 'infra', 'drive-cache'));
}

/** Download the Drive folder to a temporary folder and archive a copy (not on dry runs). */
async function downloadFromDrive(
  startedAt: Date,
  storage: ObjectStorage | null,
  log: (message: string) => void,
): Promise<{ root: string; folder: string; archive: string | null; summary: string[] }> {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();
  if (!folderId) throw new Error('Set GOOGLE_DRIVE_FOLDER_ID to the shared Drive folder');
  const client = new DriveClient(driveAuthFromEnv(process.env));
  const program = await findProgramFolder(client, folderId);
  const root = mkdtempSync(path.join(os.tmpdir(), 'la-drive-'));
  try {
    const folder = path.join(root, 'program');
    log(`Downloading "${program.name}" from Google Drive…`);
    let count = 0;
    let reused = 0;
    const result = await downloadFolder(client, program.id, folder, {
      cacheDir: driveCacheDir(),
      onFile: (file) => {
        count += 1;
        if (file.cached) reused += 1;
        if (count % 50 === 0) log(`Downloading from Google Drive: ${count} files`);
      },
    });
    log(`Got ${result.files.length} files (${result.files.length - reused} downloaded, ${reused} unchanged since the last run).`);
    let archive: string | null = null;
    if (storage) {
      archive = archivePrefix(startedAt);
      await archiveSources(storage, archive, folder, { folderId: program.id, ...result });
      log(`Archived the source files to ${archive}/`);
    }
    return { root, folder, archive, summary: sourceSummary({ folderId: program.id, ...result, archive }) };
  } catch (error) {
    rmSync(root, { recursive: true, force: true });
    throw error;
  }
}

async function importUnits(
  options: ImportOptions,
  sourceFolder: string,
  storage: ObjectStorage | null,
  log: (message: string) => void,
): Promise<UnitReport[]> {
  const { units, dryRun } = options;
  const folders = discoverUnitFolders(sourceFolder).filter(
    (folder) => units === 'all' || units.includes(unitNumber(path.basename(folder)) ?? -1),
  );
  if (folders.length === 0) throw new Error('No matching unit folders found');

  const prisma = createPrismaClient();
  const reports: UnitReport[] = [];
  try {
    const levels = await prisma.level.findMany({ where: { program: { code: 'LA' } } });
    if (levels.length === 0) throw new Error('Levels are missing. Run the database seed first.');
    const rulesForLevel = (number: number): LevelRules => (levels.find((level) => level.number === number)?.rules ?? {}) as LevelRules;

    if (!dryRun) {
      const file = backupDatabase('before-import');
      log(`Backup: ${path.relative(repoRoot, file)}`);
    }

    for (const folder of folders) {
      const parsed = await parseUnit(discoverUnit(folder), rulesForLevel);
      const code = parsed.sheet.overview.code;
      const report: UnitReport = {
        unit: code || path.basename(folder),
        title: parsed.sheet.overview.title,
        counts: {
          lessons: parsed.plans.lessons.length,
          words: parsed.sheet.words.length,
          materials: parsed.sheet.materials.length,
        },
        issues: parsed.issues,
        notes: [],
      };
      reports.push(report);
      const errors = parsed.issues.filter((issue) => issue.level === 'error').length;
      log(`${report.unit}: ${parsed.plans.lessons.length} lessons, ${parsed.issues.length} findings (${errors} errors)`);
      if (dryRun) continue;
      if (errors > 0) {
        report.notes.push('Not written: fix the errors first.');
        continue;
      }
      if (!options.force && (await hasManualEdits(prisma, code))) {
        report.notes.push('Not written: this unit was edited in Admin. Use --force to overwrite.');
        continue;
      }
      const result = await writeUnit(prisma, parsed);
      report.counts = result.counts;
      report.notes.push('Written to the database.');
      if (storage) {
        const designs = await importDraftDesigns(prisma, storage, result.unitId, parsed.files.draftDesigns);
        report.notes.push(`Draft layouts linked: ${designs.linked}.`);
        if (designs.removed) report.notes.push(`Draft layouts no longer on the source removed from materials: ${designs.removed}.`);
        if (designs.unmatched.length) report.notes.push(`Draft files with no matching material: ${designs.unmatched.join(', ')}`);
      }
    }

    if (storage) {
      const artFolder = path.join(sourceFolder, '01_BRAND', 'Characters', 'FINAL');
      const files = readdirSync(artFolder).filter((name) => /^CHAR_.*\.png$/i.test(name)).map((name) => path.join(artFolder, name));
      log(`Character art linked: ${await importCharacterArt(prisma, storage, files)}`);
    }
  } finally {
    await prisma.$disconnect();
  }
  return reports;
}
