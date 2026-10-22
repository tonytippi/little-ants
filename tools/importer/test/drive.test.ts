import { generateKeyPairSync, createVerify } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LocalStorage } from '@little-ants/storage';
import {
  DriveClient,
  apiKeyAuth,
  downloadFolder,
  driveAuthFromEnv,
  findProgramFolder,
  serviceAccountAssertion,
  serviceAccountAuth,
  type DriveFile,
} from '../src/drive.js';
import { archivePrefix, archiveSources, sourceSummary } from '../src/source-archive.js';

const FOLDER = 'application/vnd.google-apps.folder';
const SHEET = 'application/vnd.google-apps.spreadsheet';

interface Node extends DriveFile {
  parent: string | null;
  body?: string;
}

/** A tiny Drive API: files.list (two items per page), files.get, alt=media and export. */
function fakeDrive(nodes: Node[], options: { failFirst?: number } = {}) {
  const requests: string[] = [];
  let failures = options.failFirst ?? 0;
  const fetchImpl = (async (input: URL | string) => {
    const url = new URL(String(input));
    requests.push(url.toString());
    if (failures > 0) {
      failures -= 1;
      return new Response('{"error":{"message":"Rate Limit Exceeded"}}', { status: 429 });
    }
    const json = (value: unknown): Response => Response.json(value);
    if (url.pathname === '/drive/v3/files') {
      const parent = /'([^']+)' in parents/.exec(url.searchParams.get('q') ?? '')?.[1];
      const children = nodes.filter((node) => node.parent === parent);
      const start = Number(url.searchParams.get('pageToken') ?? 0);
      const page = children.slice(start, start + 2).map(({ parent: _parent, body: _body, ...file }) => file);
      return json({
        files: page,
        nextPageToken: start + 2 < children.length ? String(start + 2) : undefined,
      });
    }
    const [, id, action] = /^\/drive\/v3\/files\/([^/]+)(\/export)?$/.exec(url.pathname) ?? [];
    const node = nodes.find((candidate) => candidate.id === id);
    if (!node) return new Response('{"error":{"message":"File not found"}}', { status: 404 });
    if (action) return new Response(`exported ${node.name} as ${url.searchParams.get('mimeType')}`);
    if (url.searchParams.get('alt') === 'media') return new Response(node.body ?? '');
    const { parent: _parent, body: _body, ...file } = node;
    return json(file);
  }) as typeof fetch;
  return { fetchImpl, requests };
}

const TREE: Node[] = [
  { id: 'root', name: 'Little Ants English', mimeType: FOLDER, parent: null },
  { id: 'tn', name: 'TN 0-3', mimeType: FOLDER, parent: 'root' },
  { id: 'la', name: 'LA 3-6', mimeType: FOLDER, parent: 'root' },
  { id: 'u1', name: 'Unit01_Hello', mimeType: FOLDER, parent: 'la' },
  {
    id: 'sheet',
    name: 'U01_MASTER-SHEET',
    mimeType: SHEET,
    parent: 'u1',
    modifiedTime: '2026-10-01T00:00:00Z',
  },
  {
    id: 'pdf',
    name: 'U01_ST1_DRAFT.pdf',
    mimeType: 'application/pdf',
    parent: 'u1',
    body: 'pdf-1',
    modifiedTime: '2026-10-05T00:00:00Z',
  },
  { id: 'pdf2', name: 'U01_ST1_DRAFT.pdf', mimeType: 'application/pdf', parent: 'u1', body: 'pdf-2' },
  { id: 'form', name: 'Feedback', mimeType: 'application/vnd.google-apps.form', parent: 'u1' },
  {
    id: 'link',
    name: 'Shared poster.png',
    mimeType: 'application/vnd.google-apps.shortcut',
    parent: 'u1',
    shortcutDetails: { targetId: 'png', targetMimeType: 'image/png' },
  },
  { id: 'png', name: 'poster-original.png', mimeType: 'image/png', parent: 'elsewhere', body: 'png' },
];

/** Answers like Google's anti-abuse page instead of a rate-limit error. */
function blockedFetch(inner: typeof fetch): typeof fetch {
  return (async (input: URL | string, init?: RequestInit) => {
    const response = await inner(input, init);
    return response.status === 429
      ? new Response('<html>Sorry... automated queries</html>', { status: 403 })
      : response;
  }) as typeof fetch;
}

const temp: string[] = [];
function tempDir(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'la-drive-test-'));
  temp.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of temp.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('Google Drive download', () => {
  it('finds the LA 3-6 folder inside the shared tree, or uses a folder that holds units', async () => {
    const { fetchImpl } = fakeDrive(TREE);
    const client = new DriveClient(apiKeyAuth('test-key'), fetchImpl, 0);
    expect((await findProgramFolder(client, 'root')).id).toBe('la');
    expect((await findProgramFolder(client, 'la')).id).toBe('la');
    await expect(findProgramFolder(client, 'tn')).rejects.toThrow('"LA 3-6"');
  });

  it('downloads every page of a folder tree, exports Sheets, follows shortcuts and keeps duplicate names apart', async () => {
    const { fetchImpl } = fakeDrive(TREE);
    const target = tempDir();
    const result = await downloadFolder(new DriveClient(apiKeyAuth('test-key'), fetchImpl, 0), 'la', target);

    expect(result.files.map((file) => file.path)).toEqual([
      'Unit01_Hello/Shared poster.png',
      'Unit01_Hello/U01_MASTER-SHEET.xlsx',
      'Unit01_Hello/U01_ST1_DRAFT (1).pdf',
      'Unit01_Hello/U01_ST1_DRAFT.pdf',
    ]);
    expect(result.skipped).toEqual([path.join('Unit01_Hello', 'Feedback')]);
    const unit = path.join(target, 'Unit01_Hello');
    expect(readFileSync(path.join(unit, 'U01_MASTER-SHEET.xlsx'), 'utf8')).toContain('spreadsheetml.sheet');
    expect(readFileSync(path.join(unit, 'U01_ST1_DRAFT.pdf'), 'utf8')).toBe('pdf-1');
    expect(readFileSync(path.join(unit, 'Shared poster.png'), 'utf8')).toBe('png');
    expect(result.files.find((file) => file.id === 'sheet')).toMatchObject({
      exportedAs: '.xlsx',
      modifiedTime: '2026-10-01T00:00:00Z',
    });
  });

  it('reuses cached files whose Drive version has not changed', async () => {
    const cacheDir = tempDir();
    const first = fakeDrive(TREE);
    await downloadFolder(new DriveClient(apiKeyAuth('test-key'), first.fetchImpl, 0), 'la', tempDir(), {
      cacheDir,
    });
    const downloads = (requests: string[]): number =>
      requests.filter((url) => /alt=media|\/export/.test(url)).length;
    expect(downloads(first.requests)).toBe(4);

    const edited = TREE.map((node) =>
      node.id === 'pdf' ? { ...node, modifiedTime: '2026-10-06T00:00:00Z', body: 'pdf-new' } : node,
    );
    const second = fakeDrive(edited);
    const target = tempDir();
    const cached: string[] = [];
    await downloadFolder(new DriveClient(apiKeyAuth('test-key'), second.fetchImpl, 0), 'la', target, {
      cacheDir,
      onFile: (file) => file.cached && cached.push(file.path),
    });
    expect(cached).toEqual(['Unit01_Hello/U01_MASTER-SHEET.xlsx']);
    expect(readFileSync(path.join(target, 'Unit01_Hello', 'U01_ST1_DRAFT.pdf'), 'utf8')).toBe('pdf-new');
  });

  it('retries rate limits, and reports failures without the API key', async () => {
    const flaky = fakeDrive(TREE, { failFirst: 2 });
    expect(await new DriveClient(apiKeyAuth('test-key'), flaky.fetchImpl, 0).list('root')).toHaveLength(2);
    expect(flaky.requests).toHaveLength(3);
    expect(flaky.requests[0]).toContain('key=test-key');

    const sorry = fakeDrive(TREE, { failFirst: 99 });
    const blocked = await new DriveClient(apiKeyAuth('test-key'), blockedFetch(sorry.fetchImpl), 0)
      .list('root')
      .catch((caught: Error) => caught);
    expect(String(blocked)).toContain('service account');

    const { fetchImpl } = fakeDrive(TREE);
    const error = await new DriveClient(apiKeyAuth('test-key'), fetchImpl, 0)
      .get('missing')
      .catch((caught: Error) => caught);
    expect(String(error)).toContain('HTTP 404');
    expect(String(error)).toContain('File not found');
    expect(String(error)).not.toContain('test-key');
  });
});

describe('Drive credentials', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const account = {
    client_email: 'importer@little-ants.iam.gserviceaccount.com',
    private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  };

  it('signs a read-only Drive assertion for a service account', () => {
    const [header, claims, signature] = serviceAccountAssertion(account, 1000).split('.');
    expect(JSON.parse(Buffer.from(claims!, 'base64url').toString())).toEqual({
      iss: account.client_email,
      scope: 'https://www.googleapis.com/auth/drive.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      iat: 1000,
      exp: 4600,
    });
    const valid = createVerify('RSA-SHA256')
      .update(`${header}.${claims}`)
      .verify(publicKey, Buffer.from(signature!, 'base64url'));
    expect(valid).toBe(true);
  });

  it('exchanges the assertion for a token once and sends it as a bearer header', async () => {
    const keyFile = path.join(tempDir(), 'service-account.json');
    writeFileSync(keyFile, JSON.stringify(account));
    let exchanges = 0;
    const fetchImpl = (async () => {
      exchanges += 1;
      return Response.json({ access_token: 'token-1', expires_in: 3600 });
    }) as unknown as typeof fetch;
    const auth = serviceAccountAuth(keyFile, fetchImpl);
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    expect(await auth.authorize(url)).toEqual({ authorization: 'Bearer token-1' });
    await auth.authorize(url);
    expect(exchanges).toBe(1);
    expect(url.searchParams.has('key')).toBe(false);
  });

  it('prefers a service account file over an API key and explains what to set', () => {
    expect(() => driveAuthFromEnv({})).toThrow('GOOGLE_DRIVE_API_KEY');
    const url = new URL('https://example.com');
    void driveAuthFromEnv({ GOOGLE_DRIVE_API_KEY: ' k ' }).authorize(url);
    expect(url.searchParams.get('key')).toBe('k');
  });
});

describe('source archive', () => {
  it('copies the downloaded files and a manifest to private storage, and summarises them for the report', async () => {
    const { fetchImpl } = fakeDrive(TREE);
    const downloaded = tempDir();
    const result = await downloadFolder(
      new DriveClient(apiKeyAuth('test-key'), fetchImpl, 0),
      'la',
      downloaded,
    );
    const storageDir = tempDir();
    const prefix = archivePrefix(new Date('2026-10-22T04:10:05.123Z'));
    expect(prefix).toBe('sources/2026-10-22T04-10-05Z');

    await archiveSources(
      new LocalStorage({ rootDir: storageDir, baseUrl: 'http://localhost/storage', signingSecret: 'secret' }),
      prefix,
      downloaded,
      {
        folderId: 'la',
        ...result,
      },
    );

    const archived = path.join(storageDir, prefix);
    expect(readdirSync(path.join(archived, 'files', 'Unit01_Hello')).sort()).toHaveLength(4);
    const manifest = JSON.parse(readFileSync(path.join(archived, 'manifest.json'), 'utf8')) as {
      files: unknown[];
      folderId: string;
    };
    expect(manifest.folderId).toBe('la');
    expect(manifest.files).toHaveLength(4);

    const summary = sourceSummary({ folderId: 'la', ...result, archive: prefix }).join('\n');
    expect(summary).toContain('4 files (1 exported from Google Sheets/Docs)');
    expect(summary).toContain('2026-10-05T00:00:00Z');
    expect(summary).toContain(prefix);
  });
});
