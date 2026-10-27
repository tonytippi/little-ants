import type { ObjectStorage } from '@little-ants/storage';
import type { ManifestEntry } from './drive.js';

/** Storage prefix for one import's manifest and report, e.g. "sources/2026-10-22T04-10-00Z". */
export function archivePrefix(date: Date): string {
  return `sources/${date
    .toISOString()
    .replace(/\.\d+Z$/, 'Z')
    .replaceAll(':', '-')}`;
}

/**
 * Record what one import used: every Drive file with its id and version (md5 or modified time), in private storage
 * next to the report. Drive stays the source of truth and keeps the file history, so the files are not copied.
 */
export async function writeSourceManifest(
  storage: ObjectStorage,
  prefix: string,
  manifest: { folderId: string; files: ManifestEntry[]; skipped: string[] },
): Promise<void> {
  const body = JSON.stringify({ syncedAt: new Date().toISOString(), ...manifest }, null, 2);
  await storage.put(`${prefix}/manifest.json`, new TextEncoder().encode(body), 'application/json');
}

/** Lines for the import report: where the files came from and the newest change among them. */
export function sourceSummary(info: {
  folderId: string;
  files: ManifestEntry[];
  skipped: string[];
  archive: string | null;
}): string[] {
  const newest = info.files
    .map((file) => file.modifiedTime ?? '')
    .sort()
    .at(-1);
  const exported = info.files.filter((file) => file.exportedAs).length;
  const lines = [
    `Source: Google Drive folder \`${info.folderId}\`, ${info.files.length} files${exported ? ` (${exported} exported from Google Sheets/Docs)` : ''}.`,
  ];
  if (newest) lines.push(`Newest change in the folder: ${newest}.`);
  if (info.archive)
    lines.push(
      `Manifest: \`${info.archive}/manifest.json\` in the private bucket lists every file and its Drive version.`,
    );
  if (info.skipped.length) lines.push(`Skipped (no file to download): ${info.skipped.join(', ')}.`);
  return lines;
}
