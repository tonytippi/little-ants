#!/usr/bin/env node
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { config } from 'dotenv';
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

const repoRoot = path.resolve(import.meta.dirname, '../../..');
config({ path: path.join(repoRoot, '.env'), quiet: true });

const USAGE = `Usage: la-import [--unit U01 ...] [--all] [--dry-run] [--assets] [--force] [--drive | --source <folder>]

  --unit U01   Import one unit (repeatable). Matches the unit folder number.
  --all        Import all 12 units.
  --dry-run    Parse and check only; write the report but not the database.
  --assets     Also upload draft layout PDFs and character art to storage.
  --force      Overwrite units that were edited in Admin after the last import.
  --source     Program folder (default: docs/Little Ants English/LA 3-6).
  --drive      Read the source files from Google Drive (GOOGLE_DRIVE_FOLDER_ID) instead of a local folder.
               A copy of the downloaded files is archived to storage under sources/<time>/.`;

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      unit: { type: 'string', multiple: true },
      all: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      assets: { type: 'boolean', default: false },
      force: { type: 'boolean', default: false },
      source: { type: 'string' },
      drive: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  });
  if (values.help || (!values.all && !values.unit?.length)) {
    console.log(USAGE);
    process.exitCode = values.help ? 0 : 1;
    return;
  }
  if (values.drive && values.source) throw new Error('Use either --drive or --source, not both');
  const dryRun = values['dry-run'];
  const startedAt = new Date();
  const storage = !dryRun && (values.assets || values.drive) ? createStorageFromEnv(process.env, repoRoot) : null;
  const download = values.drive ? await downloadFromDrive(startedAt, storage) : null;
  try {
    const sourceFolder = download?.folder ?? path.resolve(values.source ?? path.join(repoRoot, 'docs', 'Little Ants English', 'LA 3-6'));
    const report = await importUnits({ values, dryRun, startedAt, sourceFolder, storage: values.assets ? storage : null, source: download?.summary ?? [] });
    if (download?.archive && storage) {
      await storage.put(`${download.archive}/report.md`, new TextEncoder().encode(report), 'text/markdown');
    }
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
): Promise<{ root: string; folder: string; archive: string | null; summary: string[] }> {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();
  if (!folderId) throw new Error('Set GOOGLE_DRIVE_FOLDER_ID to the shared Drive folder');
  const client = new DriveClient(driveAuthFromEnv(process.env));
  const program = await findProgramFolder(client, folderId);
  const root = mkdtempSync(path.join(os.tmpdir(), 'la-drive-'));
  try {
    const folder = path.join(root, 'program');
    console.log(`Downloading "${program.name}" from Google Drive…`);
    let count = 0;
    let reused = 0;
    const result = await downloadFolder(client, program.id, folder, {
      cacheDir: driveCacheDir(),
      onFile: (file) => {
        count += 1;
        if (file.cached) reused += 1;
        if (count % 50 === 0) console.log(`  ${count} files`);
      },
    });
    console.log(`Got ${result.files.length} files (${result.files.length - reused} downloaded, ${reused} unchanged since the last run).`);
    let archive: string | null = null;
    if (storage) {
      archive = archivePrefix(startedAt);
      await archiveSources(storage, archive, folder, { folderId: program.id, ...result });
      console.log(`Archived the source files to ${archive}/`);
    }
    return { root, folder, archive, summary: sourceSummary({ folderId: program.id, ...result, archive }) };
  } catch (error) {
    rmSync(root, { recursive: true, force: true });
    throw error;
  }
}

async function importUnits(run: {
  values: { all: boolean; unit?: string[]; force: boolean };
  dryRun: boolean;
  startedAt: Date;
  sourceFolder: string;
  storage: ObjectStorage | null;
  source: string[];
}): Promise<string> {
  const { values, dryRun, startedAt, sourceFolder, storage } = run;
  const wanted = new Set((values.unit ?? []).map((code) => Number(code.replace(/\D/g, ''))));
  const folders = discoverUnitFolders(sourceFolder).filter(
    (folder) => values.all || wanted.has(unitNumber(path.basename(folder)) ?? -1),
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
      console.log(`Backup: ${path.relative(repoRoot, file)}`);
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
      console.log(`${report.unit}: ${parsed.plans.lessons.length} lessons, ${parsed.issues.length} findings (${errors} errors)`);
      if (dryRun) continue;
      if (errors > 0) {
        report.notes.push('Not written: fix the errors first.');
        continue;
      }
      if (!values.force && (await hasManualEdits(prisma, code))) {
        report.notes.push('Not written: this unit was edited in Admin. Use --force to overwrite.');
        continue;
      }
      const result = await writeUnit(prisma, parsed);
      report.counts = result.counts;
      report.notes.push('Written to the database.');
      if (storage) {
        const designs = await importDraftDesigns(prisma, storage, result.unitId, parsed.files.draftDesigns);
        report.notes.push(`Draft layouts linked: ${designs.linked}.`);
        if (designs.unmatched.length) report.notes.push(`Draft files with no matching material: ${designs.unmatched.join(', ')}`);
      }
    }

    if (storage) {
      const artFolder = path.join(sourceFolder, '01_BRAND', 'Characters', 'FINAL');
      const files = readdirSync(artFolder).filter((name) => /^CHAR_.*\.png$/i.test(name)).map((name) => path.join(artFolder, name));
      console.log(`Character art linked: ${await importCharacterArt(prisma, storage, files)}`);
    }
  } finally {
    await prisma.$disconnect();
  }

  const reportDir = path.join(repoRoot, 'plans', 'reports');
  mkdirSync(reportDir, { recursive: true });
  const reportFile = uniqueReportPath(reportDir, startedAt);
  const report = renderReport(reports, { dryRun, startedAt, source: run.source });
  writeFileSync(reportFile, report);
  console.log(`Report: ${path.relative(repoRoot, reportFile)}`);
  return report;
}

/** plans/reports/import-YYMMDD-HHMM-master-sheets.md in local time; a suffix keeps earlier reports from the same minute. */
function uniqueReportPath(dir: string, date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  const stamp = `${pad(date.getFullYear() % 100)}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
  let file = path.join(dir, `import-${stamp}-master-sheets.md`);
  for (let n = 2; existsSync(file); n += 1) file = path.join(dir, `import-${stamp}-master-sheets-${n}.md`);
  return file;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
