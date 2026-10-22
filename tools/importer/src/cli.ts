#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { config } from 'dotenv';
import { createPrismaClient } from '@little-ants/db';
import { repoRoot, runImport } from './run-import.js';
import { runWorker } from './worker.js';

config({ path: path.join(repoRoot, '.env'), quiet: true });

const USAGE = `Usage: la-import [--unit U01 ...] [--all] [--dry-run] [--assets] [--force] [--drive | --source <folder>]
       la-import --worker

  --unit U01   Import one unit (repeatable). Matches the unit folder number.
  --all        Import all 12 units.
  --dry-run    Parse and check only; write the report but not the database.
  --assets     Also upload draft layout PDFs and character art to storage.
  --force      Overwrite units that were edited in Admin after the last import.
  --source     Program folder (default: docs/Little Ants English/LA 3-6).
  --drive      Read the source files from Google Drive (GOOGLE_DRIVE_FOLDER_ID) instead of a local folder.
               A copy of the downloaded files is archived to storage under sources/<time>/.
  --worker     Wait for "Sync from Google Drive" requests made in Admin and carry them out
               (all units from Drive, with files, overwriting Admin edits).`;

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
      worker: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  });
  if (values.worker) return worker();
  if (values.help || (!values.all && !values.unit?.length)) {
    console.log(USAGE);
    process.exitCode = values.help ? 0 : 1;
    return;
  }
  if (values.drive && values.source) throw new Error('Use either --drive or --source, not both');

  const result = await runImport({
    drive: values.drive,
    source: values.source,
    units: values.all ? 'all' : (values.unit ?? []).map((code) => Number(code.replace(/\D/g, ''))),
    dryRun: values['dry-run'],
    assets: values.assets,
    force: values.force,
  });
  const reportDir = path.join(repoRoot, 'plans', 'reports');
  mkdirSync(reportDir, { recursive: true });
  const reportFile = uniqueReportPath(reportDir, result.startedAt);
  writeFileSync(reportFile, result.report);
  console.log(`Report: ${path.relative(repoRoot, reportFile)}`);
}

async function worker(): Promise<void> {
  const prisma = createPrismaClient();
  const stop = new AbortController();
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => stop.abort());
  try {
    await runWorker(
      prisma,
      (log) => runImport({ drive: true, units: 'all', dryRun: false, assets: true, force: true, log }),
      { signal: stop.signal },
    );
  } finally {
    await prisma.$disconnect();
  }
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
