import path from 'node:path';
import { backupDatabase } from '@little-ants/db/backup';
import { createPrismaClient } from '@little-ants/db';
import type { LevelRules } from '@little-ants/shared';
import { createStorageFromEnv, type ObjectStorage } from '@little-ants/storage';
import { importCharacterArt, importUnitMedia, type UnitMediaResult } from './assets.js';
import {
  discoverCharacterArt,
  discoverProgramAudio,
  discoverUnit,
  discoverUnitFolders,
  unitNumber,
} from './discover.js';
import { syncFolder } from './drive.js';
import { openProgramFolder } from './drive-browse.js';
import { planUnitMedia, type MediaPlan } from './media-plan.js';
import { parseUnit } from './parse-unit.js';
import { renderReport, type UnitReport } from './report.js';
import { archivePrefix, sourceSummary, writeSourceManifest } from './source-archive.js';
import { hasManualEdits, materialRowsFor, writeUnit } from './write-unit.js';

export const repoRoot = path.resolve(import.meta.dirname, '../../..');

export interface ImportOptions {
  /** Read the source files from Google Drive (GOOGLE_DRIVE_FOLDER_ID) instead of `source`. */
  drive: boolean;
  /** Local program folder; defaults to the Drive mirror, docs/Little Ants English/LA 3-6. */
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
  /** Storage prefix of the source manifest and report (Drive runs that write). */
  archive: string | null;
}

/** Local mirror of the Drive program folder ("LA 3-6"); also the default source of a local import. */
export const SOURCE_MIRROR = path.join(repoRoot, 'docs', 'Little Ants English', 'LA 3-6');

/** Parse the Master Sheets and Word files, write them to the database and upload their files. */
export async function runImport(options: ImportOptions): Promise<ImportResult> {
  const log = options.log ?? ((message: string) => console.log(message));
  const startedAt = new Date();
  const storage =
    !options.dryRun && (options.assets || options.drive) ? createStorageFromEnv(process.env, repoRoot) : null;
  const synced = options.drive ? await syncFromDrive(startedAt, storage, log) : null;
  const sourceFolder = path.resolve(options.source ?? SOURCE_MIRROR);
  const reports = await importUnits(options, sourceFolder, options.assets ? storage : null, log);
  const report = renderReport(reports, {
    dryRun: options.dryRun,
    startedAt,
    source: synced?.summary ?? [],
  });
  if (synced?.archive && storage) {
    await storage.put(`${synced.archive}/report.md`, new TextEncoder().encode(report), 'text/markdown');
  }
  return { startedAt, report, archive: synced?.archive ?? null };
}

/** Bring the local mirror up to date with Drive and record which file versions will be imported (not on dry runs). */
async function syncFromDrive(
  startedAt: Date,
  storage: ObjectStorage | null,
  log: (message: string) => void,
): Promise<{ archive: string | null; summary: string[] }> {
  const { client, program } = await openProgramFolder(process.env);
  log(`Syncing "${program.name}" from Google Drive to ${path.relative(repoRoot, SOURCE_MIRROR)}…`);
  let count = 0;
  const result = await syncFolder(client, program.id, SOURCE_MIRROR, {
    onFile: () => {
      count += 1;
      if (count % 100 === 0) log(`Syncing from Google Drive: ${count} files checked`);
    },
  });
  log(
    `Got ${result.files.length} files (${result.downloaded} downloaded, ${result.files.length - result.downloaded} unchanged, ${result.removed.length} removed).`,
  );
  let archive: string | null = null;
  if (storage) {
    archive = archivePrefix(startedAt);
    await writeSourceManifest(storage, archive, { folderId: program.id, ...result });
    log(`Source manifest written to ${archive}/manifest.json`);
  }
  return { archive, summary: sourceSummary({ folderId: program.id, ...result, archive }) };
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
    const rulesForLevel = (number: number): LevelRules =>
      (levels.find((level) => level.number === number)?.rules ?? {}) as LevelRules;

    const programAudio = discoverProgramAudio(sourceFolder);

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
      log(
        `${report.unit}: ${parsed.plans.lessons.length} lessons, ${parsed.issues.length} findings (${errors} errors)`,
      );
      const plan = planUnitMedia({
        unitCode: code,
        draftDesigns: parsed.files.draftDesigns,
        finalFiles: parsed.files.finalFiles,
        audio: [...parsed.files.audio, ...programAudio],
        materials: materialRowsFor(parsed.sheet),
        words: parsed.sheet.words,
      });
      if (dryRun) {
        report.notes.push(...mediaNotes(plannedCounts(plan), plan, folder, 'Files to link'));
        continue;
      }
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
        const media = await importUnitMedia(prisma, storage, result.unitId, plan);
        report.notes.push(...mediaNotes(media, plan, folder, 'Files linked'));
      }
    }

    if (storage) {
      const files = discoverCharacterArt(sourceFolder);
      if (files.length) log(`Character art linked: ${await importCharacterArt(prisma, storage, files)}`);
      else log('Character art not linked: no CHAR_*.png under 01_BRAND/Characters/FINAL or v<N>_FINAL');
    }
  } finally {
    await prisma.$disconnect();
  }
  return reports;
}

const ROLE_LABELS: Record<string, string> = {
  'draft-layout': 'draft layouts',
  poster: 'pictures',
  audio: 'recordings',
  print: 'print files',
  word: 'word pictures',
  cover: 'unit cover',
  place: 'place pictures',
  page: 'page pictures',
};

/** Report lines for a unit's files: what was linked, what was undone, and which files were left out and why. */
function mediaNotes(media: UnitMediaResult, plan: MediaPlan, unitFolder: string, heading: string): string[] {
  const linked = Object.entries(media.linked).map(([role, count]) => `${count} ${ROLE_LABELS[role] ?? role}`);
  const notes = [`${heading}: ${linked.length ? linked.join(', ') : 'none'}.`];
  if (media.removed) notes.push(`Files no longer on the source removed: ${media.removed}.`);
  const lighter = plan.ignored.filter((item) => /lighter copy/.test(item.reason)).length;
  if (lighter) notes.push(`4K copies not used (a lighter copy of the same picture is linked): ${lighter}.`);
  for (const item of plan.ignored.filter((entry) => !/lighter copy/.test(entry.reason))) {
    notes.push(
      `Not used: ${path.relative(unitFolder, item.file).split(path.sep).join('/')} (${item.reason}).`,
    );
  }
  return notes;
}

/** What a dry run would link, in the same shape as a real import's result. */
function plannedCounts(plan: MediaPlan): UnitMediaResult {
  const files = new Map<string, Set<string>>();
  for (const link of plan.links) files.set(link.role, (files.get(link.role) ?? new Set()).add(link.file));
  const linked: Record<string, number> = Object.fromEntries(
    [...files].map(([role, set]) => [role, set.size]),
  );
  if (plan.words.length) linked.word = plan.words.length;
  for (const picture of plan.pictures) linked[picture.role] = (linked[picture.role] ?? 0) + 1;
  if (plan.pages.length) linked.page = plan.pages.length;
  return { linked, removed: 0 };
}
