import { generateKeyPairSync, createVerify } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LocalStorage } from '@little-ants/storage';
import {
  DriveClient,
  apiKeyAuth,
  driveAuthFromEnv,
  findProgramFolder,
  serviceAccountAssertion,
  serviceAccountAuth,
  syncFolder,
  SYNC_STATE_FILE,
  type DriveFile,
} from '../src/drive.js';
import { driveTree, openProgramFolder, resolveDrivePath } from '../src/drive-browse.js';
import { archivePrefix, sourceSummary, writeSourceManifest } from '../src/source-archive.js';

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

  it('mirrors every page of a folder tree, exports Sheets, follows shortcuts and keeps duplicate names apart', async () => {
    const { fetchImpl } = fakeDrive([
      ...TREE,
      { id: 'tools', name: '.claude', mimeType: FOLDER, parent: 'la' },
      { id: 'skill', name: 'skill.md', mimeType: 'text/markdown', parent: 'tools', body: '#' },
      { id: 'claude', name: 'CLAUDE.md', mimeType: 'text/markdown', parent: 'la', body: '# For AI tools' },
    ]);
    const target = tempDir();
    const result = await syncFolder(new DriveClient(apiKeyAuth('test-key'), fetchImpl, 0), 'la', target);

    expect(result.files.map((file) => file.path)).toEqual([
      'Unit01_Hello/Shared poster.png',
      'Unit01_Hello/U01_MASTER-SHEET.xlsx',
      'Unit01_Hello/U01_ST1_DRAFT (1).pdf',
      'Unit01_Hello/U01_ST1_DRAFT.pdf',
    ]);
    expect(result).toMatchObject({ downloaded: 4, removed: [] });
    expect(result.skipped).toEqual([path.join('Unit01_Hello', 'Feedback')]);
    expect(existsSync(path.join(target, '.claude'))).toBe(false);
    expect(existsSync(path.join(target, 'CLAUDE.md'))).toBe(false);
    const unit = path.join(target, 'Unit01_Hello');
    expect(readFileSync(path.join(unit, 'U01_MASTER-SHEET.xlsx'), 'utf8')).toContain('spreadsheetml.sheet');
    expect(readFileSync(path.join(unit, 'U01_ST1_DRAFT.pdf'), 'utf8')).toBe('pdf-1');
    expect(readFileSync(path.join(unit, 'Shared poster.png'), 'utf8')).toBe('png');
    expect(result.files.find((file) => file.id === 'sheet')).toMatchObject({
      exportedAs: '.xlsx',
      modifiedTime: '2026-10-01T00:00:00Z',
    });
  });

  it('downloads only what changed on Drive or locally, and deletes what Drive no longer has', async () => {
    const target = tempDir();
    const downloads = (requests: string[]): number =>
      requests.filter((url) => /alt=media|\/export/.test(url)).length;
    const first = fakeDrive(TREE);
    await syncFolder(new DriveClient(apiKeyAuth('test-key'), first.fetchImpl, 0), 'la', target);
    expect(downloads(first.requests)).toBe(4);

    const unit = path.join(target, 'Unit01_Hello');
    writeFileSync(path.join(unit, 'my-notes.txt'), 'kept');
    writeFileSync(path.join(unit, 'Shared poster.png'), 'edited locally');
    const edited = TREE.filter((node) => node.id !== 'pdf2').map((node) =>
      node.id === 'pdf'
        ? { ...node, md5Checksum: 'new', body: 'pdf-new' }
        : node.id === 'png'
          ? { ...node, md5Checksum: 'png-v1' }
          : node,
    );
    const second = fakeDrive(edited);
    const fetched: string[] = [];
    const result = await syncFolder(
      new DriveClient(apiKeyAuth('test-key'), second.fetchImpl, 0),
      'la',
      target,
      {
        onFile: (file) => file.downloaded && fetched.push(file.path),
      },
    );

    expect(fetched.sort()).toEqual(['Unit01_Hello/Shared poster.png', 'Unit01_Hello/U01_ST1_DRAFT.pdf']);
    expect(result).toMatchObject({ downloaded: 2, removed: ['Unit01_Hello/U01_ST1_DRAFT (1).pdf'] });
    expect(readFileSync(path.join(unit, 'U01_ST1_DRAFT.pdf'), 'utf8')).toBe('pdf-new');
    expect(readFileSync(path.join(unit, 'Shared poster.png'), 'utf8')).toBe('png');
    expect(existsSync(path.join(unit, 'U01_ST1_DRAFT (1).pdf'))).toBe(false);
    expect(readFileSync(path.join(unit, 'my-notes.txt'), 'utf8')).toBe('kept');
    expect(Object.keys(JSON.parse(readFileSync(path.join(target, SYNC_STATE_FILE), 'utf8')))).toHaveLength(3);

    const third = fakeDrive(edited);
    await syncFolder(new DriveClient(apiKeyAuth('test-key'), third.fetchImpl, 0), 'la', target);
    expect(downloads(third.requests)).toBe(0);
  });

  it('keeps the record of files not reached when a sync fails half way', async () => {
    const target = tempDir();
    await syncFolder(new DriveClient(apiKeyAuth('test-key'), fakeDrive(TREE).fetchImpl, 0), 'la', target);
    const failing = fakeDrive(
      TREE.map((node) => (node.id === 'pdf' ? { ...node, md5Checksum: 'v2' } : node)),
    );
    const broken = (async (input: URL | string, init?: RequestInit) =>
      String(input).includes('/files/pdf?')
        ? new Response('{"error":{"message":"Forbidden"}}', { status: 403 })
        : failing.fetchImpl(input, init)) as typeof fetch;
    await expect(
      syncFolder(new DriveClient(apiKeyAuth('test-key'), broken, 0), 'la', target, { concurrency: 1 }),
    ).rejects.toThrow('HTTP 403');
    const state = JSON.parse(readFileSync(path.join(target, SYNC_STATE_FILE), 'utf8')) as Record<
      string,
      unknown
    >;
    expect(Object.keys(state)).toHaveLength(4);
    expect(existsSync(path.join(target, 'Unit01_Hello', 'U01_ST1_DRAFT (1).pdf'))).toBe(true);
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

describe('source manifest', () => {
  it('stores which Drive file versions were used, without copying the files, and summarises them', async () => {
    const { fetchImpl } = fakeDrive(TREE);
    const result = await syncFolder(new DriveClient(apiKeyAuth('test-key'), fetchImpl, 0), 'la', tempDir());
    const storageDir = tempDir();
    const prefix = archivePrefix(new Date('2026-10-22T04:10:05.123Z'));
    expect(prefix).toBe('sources/2026-10-22T04-10-05Z');

    await writeSourceManifest(
      new LocalStorage({ rootDir: storageDir, baseUrl: 'http://localhost/storage', signingSecret: 'secret' }),
      prefix,
      { folderId: 'la', ...result },
    );

    const stored = path.join(storageDir, prefix);
    expect(readdirSync(stored)).toEqual(['manifest.json']);
    const manifest = JSON.parse(readFileSync(path.join(stored, 'manifest.json'), 'utf8')) as {
      files: { path: string; md5Checksum: string | null }[];
      folderId: string;
    };
    expect(manifest.folderId).toBe('la');
    expect(manifest.files).toHaveLength(4);

    const summary = sourceSummary({ folderId: 'la', ...result, archive: prefix }).join('\n');
    expect(summary).toContain('4 files (1 exported from Google Sheets/Docs)');
    expect(summary).toContain('2026-10-05T00:00:00Z');
    expect(summary).toContain(`${prefix}/manifest.json`);
  });
});

describe('Google Drive browsing', () => {
  const BROWSE_TREE: Node[] = [
    ...TREE,
    { id: 'readme', name: 'README', mimeType: 'application/vnd.google-apps.document', parent: 'la' },
    { id: 'notes', name: 'notes.md', mimeType: 'text/markdown', parent: 'la', body: '# Notes' },
    { id: 'brand', name: '01_BRAND', mimeType: FOLDER, parent: 'la' },
    { id: 'final', name: 'v2_FINAL', mimeType: FOLDER, parent: 'brand' },
    { id: 'annie', name: 'CHAR_01_Annie.png', mimeType: 'image/png', parent: 'final' },
    {
      id: 'to-final',
      name: 'Latest art',
      mimeType: 'application/vnd.google-apps.shortcut',
      parent: 'brand',
      shortcutDetails: { targetId: 'final', targetMimeType: FOLDER },
    },
  ];
  const browse = () => new DriveClient(apiKeyAuth('test-key'), fakeDrive(BROWSE_TREE).fetchImpl, 0);

  it('resolves paths below the program folder, ignoring case and following shortcuts', async () => {
    const client = browse();
    const program = await findProgramFolder(client, 'root');
    expect((await resolveDrivePath(client, program, '.')).id).toBe('la');
    expect((await resolveDrivePath(client, program, '01_brand/V2_FINAL/CHAR_01_Annie.png')).id).toBe('annie');
    const viaShortcut = await resolveDrivePath(client, program, '01_BRAND/Latest art');
    expect(viaShortcut).toMatchObject({ id: 'final', name: 'Latest art' });
  });

  it('names what a folder holds when a path is wrong', async () => {
    const client = browse();
    const program = await findProgramFolder(client, 'root');
    await expect(resolveDrivePath(client, program, '01_BRAND/FINAL')).rejects.toThrow(
      'No "FINAL" in "01_BRAND". It holds: v2_FINAL, Latest art',
    );
    await expect(resolveDrivePath(client, program, 'notes.md/x')).rejects.toThrow('"notes.md" is a file');
  });

  it('lists folders first and opens subfolders up to the depth', async () => {
    const client = browse();
    const program = await findProgramFolder(client, 'root');
    const brand = await resolveDrivePath(client, program, '01_BRAND');
    expect(await driveTree(client, brand, 0)).toEqual(['Latest art/ (shortcut)', 'v2_FINAL/']);
    expect(await driveTree(client, brand, 1)).toEqual([
      'Latest art/ (shortcut)',
      '  CHAR_01_Annie.png',
      'v2_FINAL/',
      '  CHAR_01_Annie.png',
    ]);
  });

  it('reads Google Docs as plain text and other files as they are', async () => {
    const client = browse();
    const program = await findProgramFolder(client, 'root');
    expect(await client.text(await resolveDrivePath(client, program, 'README'))).toBe(
      'exported README as text/plain',
    );
    expect(await client.text(await resolveDrivePath(client, program, 'notes.md'))).toBe('# Notes');
  });

  it('needs the shared folder id', async () => {
    await expect(openProgramFolder({ GOOGLE_DRIVE_API_KEY: 'key' })).rejects.toThrow(
      'GOOGLE_DRIVE_FOLDER_ID',
    );
  });
});
