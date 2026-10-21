#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { config } from 'dotenv';
import { backupDatabase } from '@little-ants/db/backup';
import { createPrismaClient } from '@little-ants/db';
import type { LevelRules } from '@little-ants/shared';
import { createStorageFromEnv } from '@little-ants/storage';
import { importCharacterArt, importDraftDesigns } from './assets.js';
import { discoverUnit, discoverUnitFolders } from './discover.js';
import { parseUnit } from './parse-unit.js';
import { renderReport, type UnitReport } from './report.js';
import { hasManualEdits, writeUnit } from './write-unit.js';

const repoRoot = path.resolve(import.meta.dirname, '../../..');
config({ path: path.join(repoRoot, '.env'), quiet: true });

const USAGE = `Usage: la-import [--unit U01 ...] [--all] [--dry-run] [--assets] [--force]

  --unit U01   Import one unit (repeatable). Matches the unit folder number.
  --all        Import all 12 units.
  --dry-run    Parse and check only; write the report but not the database.
  --assets     Also upload draft layout PDFs and character art to storage.
  --force      Overwrite units that were edited in Admin after the last import.
  --source     Program folder (default: docs/Little Ants English/LA 3-6).`;

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      unit: { type: 'string', multiple: true },
      all: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      assets: { type: 'boolean', default: false },
      force: { type: 'boolean', default: false },
      source: { type: 'string' },
      help: { type: 'boolean', default: false },
    },
  });
  if (values.help || (!values.all && !values.unit?.length)) {
    console.log(USAGE);
    process.exitCode = values.help ? 0 : 1;
    return;
  }
  const dryRun = values['dry-run'];
  const sourceFolder = path.resolve(values.source ?? path.join(repoRoot, 'docs', 'Little Ants English', 'LA 3-6'));
  const wanted = new Set((values.unit ?? []).map((code) => Number(code.replace(/\D/g, ''))));
  const folders = discoverUnitFolders(sourceFolder).filter(
    (folder) => values.all || wanted.has(Number(/Unit (\d+)/.exec(path.basename(folder))?.[1])),
  );
  if (folders.length === 0) throw new Error('No matching unit folders found');

  const prisma = createPrismaClient();
  const startedAt = new Date();
  const reports: UnitReport[] = [];
  try {
    const levels = await prisma.level.findMany({ where: { program: { code: 'LA' } } });
    if (levels.length === 0) throw new Error('Levels are missing. Run the database seed first.');
    const rulesForLevel = (number: number): LevelRules => (levels.find((level) => level.number === number)?.rules ?? {}) as LevelRules;
    const storage = values.assets && !dryRun ? createStorageFromEnv(process.env, repoRoot) : null;

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
  writeFileSync(reportFile, renderReport(reports, { dryRun, startedAt }));
  console.log(`Report: ${path.relative(repoRoot, reportFile)}`);
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
