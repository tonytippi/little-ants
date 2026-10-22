import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LocalStorage, S3Storage, assetStorageKey } from '../src/index.js';

describe('assetStorageKey', () => {
  it('builds a versioned, URL-safe key', () => {
    expect(assetStorageKey('abc', 2, 'U01 SG1 Hello, Friends!.png')).toBe(
      'assets/abc/v2/u01-sg1-hello-friends-.png',
    );
  });
});

describe('LocalStorage', () => {
  let dir: string;
  let storage: LocalStorage;

  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'la-storage-'));
    storage = new LocalStorage({
      rootDir: dir,
      baseUrl: 'http://api.test/storage',
      signingSecret: 'x'.repeat(32),
    });
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('stores files and reports their size', async () => {
    await storage.put('assets/a/v1/file.txt', new TextEncoder().encode('hello'));
    expect(await storage.head('assets/a/v1/file.txt')).toEqual({ sizeBytes: 5 });
    expect(await storage.head('assets/missing')).toBeNull();
  });

  it('rejects keys that escape the storage folder', async () => {
    await expect(storage.put('../outside.txt', new Uint8Array())).rejects.toThrow(/Invalid storage key/);
  });

  it('signs URLs that only verify for the same action, key and content type', async () => {
    const url = new URL(await storage.signedUploadUrl('assets/a/v1/file.png', 'image/png'));
    const expires = Number(url.searchParams.get('expires'));
    const signature = url.searchParams.get('signature') ?? '';
    expect(storage.verify('upload', 'assets/a/v1/file.png', expires, signature, 'image/png')).toBe(true);
    expect(storage.verify('read', 'assets/a/v1/file.png', expires, signature, 'image/png')).toBe(false);
    expect(storage.verify('upload', 'assets/a/v1/other.png', expires, signature, 'image/png')).toBe(false);
    expect(storage.verify('upload', 'assets/a/v1/file.png', expires, signature, 'text/html')).toBe(false);
  });

  it('rejects expired signatures', () => {
    expect(storage.verify('read', 'k', Math.floor(Date.now() / 1000) - 1, 'sig')).toBe(false);
  });
});

describe('S3Storage', () => {
  const s3 = new S3Storage({
    endpoint: 'https://account.r2.cloudflarestorage.com',
    region: 'auto',
    bucket: 'private-bucket',
    publicBucket: 'public-bucket',
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret',
    publicBaseUrl: 'https://media.example.com/',
  });

  it('signs the upload size so R2 rejects any other size', async () => {
    const url = new URL(await s3.signedUploadUrl('assets/a/v1/poster.png', 'image/png', 900, 1234));
    expect(url.hostname).toContain('private-bucket');
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toContain('content-length');
  });

  it('serves public URLs from the media domain', () => {
    expect(s3.publicUrl('assets/a/v1/poster.png')).toBe('https://media.example.com/assets/a/v1/poster.png');
  });
});
