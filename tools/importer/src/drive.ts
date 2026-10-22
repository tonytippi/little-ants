import { createSign } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { unitNumber } from './discover.js';

const API = 'https://www.googleapis.com/drive/v3';
const FOLDER = 'application/vnd.google-apps.folder';
const SHORTCUT = 'application/vnd.google-apps.shortcut';

/** Google Sheets/Docs have no file to download; they are exported to the Office format the importer reads. */
const EXPORTS: Record<string, { mime: string; extension: string }> = {
  'application/vnd.google-apps.spreadsheet': {
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extension: '.xlsx',
  },
  'application/vnd.google-apps.document': {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extension: '.docx',
  },
};

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  md5Checksum?: string;
  shortcutDetails?: { targetId: string; targetMimeType: string };
}

/** One downloaded file: where it came from and where it was saved (relative to the download folder). */
export interface ManifestEntry {
  path: string;
  id: string;
  mimeType: string;
  modifiedTime: string | null;
  md5Checksum: string | null;
  exportedAs: string | null;
}

export interface DownloadResult {
  files: ManifestEntry[];
  /** Drive items that cannot become files (forms, drawings…), by path. */
  skipped: string[];
}

/** Adds credentials to a Drive API request: an API key (public folders) or a service account token. */
export interface DriveAuth {
  authorize(url: URL): Promise<Record<string, string>>;
}

export function apiKeyAuth(key: string): DriveAuth {
  return {
    authorize(url) {
      url.searchParams.set('key', key);
      return Promise.resolve({});
    },
  };
}

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

/** Signed JWT a service account exchanges for an access token (Google's "JWT bearer" flow). */
export function serviceAccountAssertion(account: ServiceAccountKey, now = Math.floor(Date.now() / 1000)): string {
  const encode = (value: object): string => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    aud: account.token_uri ?? 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(account.private_key).toString('base64url');
  return `${unsigned}.${signature}`;
}

export function serviceAccountAuth(keyFile: string, fetchImpl: typeof fetch = fetch): DriveAuth {
  const account = JSON.parse(readFileSync(keyFile, 'utf8')) as ServiceAccountKey;
  let token: { value: string; expiresAt: number } | null = null;
  return {
    async authorize() {
      if (!token || token.expiresAt < Date.now() + 60_000) {
        const response = await fetchImpl(account.token_uri ?? 'https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: serviceAccountAssertion(account),
          }),
        });
        if (!response.ok) throw new Error(`Service account sign-in failed (HTTP ${response.status})`);
        const body = (await response.json()) as { access_token: string; expires_in: number };
        token = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
      }
      return { authorization: `Bearer ${token.value}` };
    },
  };
}

/** GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE wins over GOOGLE_DRIVE_API_KEY; the key only reads folders shared by link. */
export function driveAuthFromEnv(env: Record<string, string | undefined>): DriveAuth {
  const keyFile = env.GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE?.trim();
  if (keyFile) return serviceAccountAuth(keyFile);
  const key = env.GOOGLE_DRIVE_API_KEY?.trim();
  if (key) return apiKeyAuth(key);
  throw new Error('Set GOOGLE_DRIVE_API_KEY (folder shared by link) or GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE to read from Google Drive');
}

export class DriveClient {
  constructor(
    private readonly auth: DriveAuth,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly retryDelayMs = 1000,
  ) {}

  /** Children of a folder (all pages), shared drives included. */
  async list(folderId: string): Promise<DriveFile[]> {
    const files: DriveFile[] = [];
    let pageToken: string | undefined;
    do {
      const url = new URL(`${API}/files`);
      url.searchParams.set('q', `'${folderId}' in parents and trashed = false`);
      url.searchParams.set('fields', 'nextPageToken, files(id, name, mimeType, modifiedTime, size, md5Checksum, shortcutDetails)');
      url.searchParams.set('pageSize', '1000');
      url.searchParams.set('supportsAllDrives', 'true');
      url.searchParams.set('includeItemsFromAllDrives', 'true');
      if (pageToken) url.searchParams.set('pageToken', pageToken);
      const body = (await (await this.request(url)).json()) as { files: DriveFile[]; nextPageToken?: string };
      files.push(...body.files);
      pageToken = body.nextPageToken;
    } while (pageToken);
    return files;
  }

  async get(fileId: string): Promise<DriveFile> {
    const url = new URL(`${API}/files/${fileId}`);
    url.searchParams.set('fields', 'id, name, mimeType, modifiedTime, size, md5Checksum');
    url.searchParams.set('supportsAllDrives', 'true');
    return (await (await this.request(url)).json()) as DriveFile;
  }

  /** File contents; Google Sheets/Docs are exported to xlsx/docx. */
  async content(file: DriveFile): Promise<Uint8Array> {
    const exported = EXPORTS[file.mimeType];
    const url = new URL(exported ? `${API}/files/${file.id}/export` : `${API}/files/${file.id}`);
    if (exported) url.searchParams.set('mimeType', exported.mime);
    else {
      url.searchParams.set('alt', 'media');
      url.searchParams.set('supportsAllDrives', 'true');
    }
    return new Uint8Array(await (await this.request(url)).arrayBuffer());
  }

  /** GET with credentials; retries rate limits and server errors with backoff. */
  private async request(url: URL, attempt = 0): Promise<Response> {
    const headers = await this.auth.authorize(url);
    const response = await this.fetchImpl(url, { headers });
    if (response.ok) return response;
    const detail = await response.text().catch(() => '');
    const rateLimited = response.status === 429 || (response.status === 403 && /rateLimitExceeded|quotaExceeded/i.test(detail));
    // Google answers bursts of anonymous (API key) downloads with a "sorry, automated queries" page for a while.
    const blocked = response.status === 403 && /automated queries/i.test(detail);
    if ((rateLimited || response.status >= 500) && attempt < 5) {
      await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs * 2 ** attempt));
      return this.request(url, attempt + 1);
    }
    if (blocked && attempt < 4) {
      await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs * 15 * 2 ** attempt));
      return this.request(url, attempt + 1);
    }
    if (blocked) {
      throw new Error(
        'Google Drive is temporarily refusing downloads from this network (too many in a short time). ' +
          'Wait an hour and run again, or use a service account (GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE), which is not limited this way.',
      );
    }
    const reason =
      /"message":\s*"([^"]+)"/.exec(detail)?.[1] ??
      (detail.replaceAll(/<[^>]+>/g, ' ').replaceAll(/\s+/g, ' ').trim().slice(0, 200) || response.statusText);
    // Never include the URL: with an API key it carries the key.
    throw new Error(`Google Drive request failed (HTTP ${response.status}, ${describe(url)}): ${reason}`);
  }
}

/** What a request was for, without query parameters (they may hold the API key). */
function describe(url: URL): string {
  const [, id, action] = /\/files(?:\/([^/]+))?(\/export)?$/.exec(url.pathname) ?? [];
  if (!id) return 'list folder';
  if (action) return `export ${id}`;
  return url.searchParams.get('alt') === 'media' ? `download ${id}` : `file ${id}`;
}

/** Drive allows "/" and duplicate names; files on disk need neither. */
function safeName(name: string, taken: Set<string>): string {
  const clean = name.replaceAll(/[/\\]/g, '_').trim() || 'untitled';
  let candidate = clean;
  for (let n = 1; taken.has(candidate.toLowerCase()); n += 1) {
    const ext = path.extname(clean);
    candidate = `${clean.slice(0, clean.length - ext.length)} (${n})${ext}`;
  }
  taken.add(candidate.toLowerCase());
  return candidate;
}

/**
 * The program folder to import: the folder itself when it holds the unit folders,
 * otherwise its "LA 3-6" child (the shared folder is usually the whole "Little Ants English" tree).
 */
export async function findProgramFolder(client: DriveClient, folderId: string, programName = 'LA 3-6'): Promise<DriveFile> {
  const children = await client.list(folderId);
  if (children.some((child) => child.mimeType === FOLDER && unitNumber(child.name) !== null)) {
    return client.get(folderId);
  }
  const program = children.find((child) => child.mimeType === FOLDER && child.name.trim() === programName);
  if (!program) throw new Error(`The Drive folder has no unit folders and no "${programName}" folder`);
  return program;
}

/**
 * Cache file name for one version of a Drive file. Binary files change md5 when edited;
 * Google Sheets/Docs have no md5, so their modified time stands in.
 */
function cacheName(file: DriveFile): string | null {
  const version = file.md5Checksum ?? file.modifiedTime;
  return version ? `${file.id}-${version.replaceAll(/[^a-z0-9]/gi, '')}` : null;
}

/**
 * Download a Drive folder tree into `target`, a few files at a time.
 * With `cacheDir`, files whose Drive version was downloaded before are copied from there instead.
 */
export async function downloadFolder(
  client: DriveClient,
  folderId: string,
  target: string,
  options: { concurrency?: number; cacheDir?: string; onFile?: (entry: ManifestEntry & { cached: boolean }) => void } = {},
): Promise<DownloadResult> {
  const pending: { file: DriveFile; relative: string }[] = [];
  const skipped: string[] = [];

  const walk = async (id: string, relative: string): Promise<void> => {
    mkdirSync(path.join(target, relative), { recursive: true });
    const taken = new Set<string>();
    for (const child of await client.list(id)) {
      let item = child;
      if (child.mimeType === SHORTCUT && child.shortcutDetails) {
        item = { ...(await client.get(child.shortcutDetails.targetId)), name: child.name };
      }
      if (item.mimeType === FOLDER) {
        await walk(item.id, path.join(relative, safeName(item.name, taken)));
        continue;
      }
      const exported = EXPORTS[item.mimeType];
      if (item.mimeType.startsWith('application/vnd.google-apps.') && !exported) {
        skipped.push(path.join(relative, item.name));
        continue;
      }
      const name = exported && !item.name.toLowerCase().endsWith(exported.extension) ? `${item.name}${exported.extension}` : item.name;
      pending.push({ file: item, relative: path.join(relative, safeName(name, taken)) });
    }
  };
  await walk(folderId, '');

  const files: ManifestEntry[] = [];
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < pending.length) {
      const { file, relative } = pending[next++]!;
      const destination = path.join(target, relative);
      const cached = options.cacheDir && cacheName(file) ? path.join(options.cacheDir, cacheName(file)!) : null;
      const hit = cached !== null && existsSync(cached);
      if (hit) copyFileSync(cached, destination);
      else {
        writeFileSync(destination, await client.content(file));
        if (cached) {
          mkdirSync(options.cacheDir!, { recursive: true });
          // Write then rename, so an interrupted run never leaves a half file in the cache.
          copyFileSync(destination, `${cached}.part`);
          renameSync(`${cached}.part`, cached);
        }
      }
      const entry: ManifestEntry = {
        path: relative.split(path.sep).join('/'),
        id: file.id,
        mimeType: file.mimeType,
        modifiedTime: file.modifiedTime ?? null,
        md5Checksum: file.md5Checksum ?? null,
        exportedAs: EXPORTS[file.mimeType]?.extension ?? null,
      };
      files.push(entry);
      options.onFile?.({ ...entry, cached: hit });
    }
  };
  await Promise.all(Array.from({ length: options.concurrency ?? 2 }, worker));
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { files, skipped };
}
