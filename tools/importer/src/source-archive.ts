import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ObjectStorage } from '@little-ants/storage';
import type { ManifestEntry } from './drive.js';

const CONTENT_TYPES: Record<string, string> = {
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

/** Storage prefix for one import's source files, e.g. "sources/2026-10-22T04-10-00Z". */
export function archivePrefix(date: Date): string {
  return `sources/${date
    .toISOString()
    .replace(/\.\d+Z$/, 'Z')
    .replaceAll(':', '-')}`;
}

/**
 * Copy the downloaded source files to private storage with a manifest, so every import can be traced
 * back to the exact Excel/Word files it used even after the Drive folder changes.
 */
export async function archiveSources(
  storage: ObjectStorage,
  prefix: string,
  folder: string,
  manifest: { folderId: string; files: ManifestEntry[]; skipped: string[] },
): Promise<void> {
  for (const file of manifest.files) {
    await storage.put(
      `${prefix}/files/${file.path}`,
      readFileSync(path.join(folder, ...file.path.split('/'))),
      CONTENT_TYPES[path.extname(file.path).toLowerCase()] ?? 'application/octet-stream',
    );
  }
  const body = JSON.stringify({ downloadedAt: new Date().toISOString(), ...manifest }, null, 2);
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
      `Archived copy: \`${info.archive}/\` in the private bucket (manifest.json lists every file and its Drive version).`,
    );
  if (info.skipped.length) lines.push(`Skipped (no file to download): ${info.skipped.join(', ')}.`);
  return lines;
}
