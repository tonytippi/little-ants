#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { config } from 'dotenv';
import { createPrismaClient } from '@little-ants/db';
import { driveTree, openProgramFolder, resolveDrivePath } from './drive-browse.js';
import { repoRoot, runImport } from './run-import.js';
import { runTestDataSeed, testDataAfterSync, testDataReport } from './test-data.js';
import { runWorker } from './worker.js';

config({ path: path.join(repoRoot, '.env'), quiet: true });

const USAGE = `Usage: la-import [--unit U01 ...] [--all] [--dry-run] [--assets] [--force] [--drive | --source <folder>]
       la-import --worker
       la-import --drive-list <path> [--depth N]
       la-import --drive-cat <path>

  --unit U01   Import one unit (repeatable). Matches the unit folder number.
  --all        Import all 12 units.
  --dry-run    Parse and check only; write the report but not the database.
  --assets     Also upload draft layout PDFs and character art to storage.
  --force      Overwrite units that were edited in Admin after the last import.
  --source     Program folder (default: docs/Little Ants English/LA 3-6).
  --drive      First sync the local mirror (docs/Little Ants English/LA 3-6) with Google Drive (GOOGLE_DRIVE_FOLDER_ID):
               only changed files are downloaded, files removed from Drive are deleted. Then import from it.
               A real run stores a manifest of the Drive file versions and the report under sources/<time>/.
  --worker     Wait for "Sync from Google Drive" requests made in Admin and carry them out
               (all units from Drive, with files, overwriting Admin edits). With TEST_DATA_AFTER_SYNC=true,
               each sync then approves and publishes the units as imported (the API's seed-test).
  --drive-list Show the Drive folders and files below <path>, relative to the program folder ("." for LA 3-6 itself).
  --depth N    How many levels of subfolders --drive-list opens (default 1).
  --drive-cat  Print a text file from Drive, e.g. README.md (Google Docs as text, Sheets as CSV).`;

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
      'drive-list': { type: 'string' },
      'drive-cat': { type: 'string' },
      depth: { type: 'string', default: '1' },
      help: { type: 'boolean', default: false },
    },
  });
  if (values.worker) return worker();
  if (values['drive-list'] !== undefined) return driveList(values['drive-list'], Number(values.depth));
  if (values['drive-cat'] !== undefined) return driveCat(values['drive-cat']);
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
      async (log) => {
        const result = await runImport({
          drive: true,
          units: 'all',
          dryRun: false,
          assets: true,
          force: true,
          log,
        });
        if (!testDataAfterSync(process.env)) return result;
        log('Approving and publishing the imported units (test data)…');
        return { ...result, report: result.report + testDataReport(await runTestDataSeed()) };
      },
      { signal: stop.signal },
    );
  } finally {
    await prisma.$disconnect();
  }
}

async function driveList(drivePath: string, depth: number): Promise<void> {
  if (!Number.isInteger(depth) || depth < 0) throw new Error('--depth must be a whole number, 0 or more');
  const { client, program } = await openProgramFolder(process.env);
  const folder = await resolveDrivePath(client, program, drivePath);
  if (folder.mimeType !== 'application/vnd.google-apps.folder')
    throw new Error(`"${drivePath}" is a file; use --drive-cat`);
  console.log(`${program.name}/${drivePath.replace(/^\.?\/?/, '')}`);
  for (const line of await driveTree(client, folder, depth)) console.log(`  ${line}`);
}

async function driveCat(drivePath: string): Promise<void> {
  const { client, program } = await openProgramFolder(process.env);
  const file = await resolveDrivePath(client, program, drivePath);
  if (file.mimeType === 'application/vnd.google-apps.folder')
    throw new Error(`"${drivePath}" is a folder; use --drive-list`);
  process.stdout.write(await client.text(file));
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
