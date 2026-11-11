import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
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
  let dir: string;
  let s3: S3Storage;

  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'la-s3-storage-'));
    s3 = new S3Storage(
      {
        endpoint: 'https://account.r2.cloudflarestorage.com',
        region: 'auto',
        bucket: 'public-bucket',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
        publicBaseUrl: 'https://media.example.com/',
      },
      new LocalStorage({
        rootDir: dir,
        baseUrl: 'https://api.test/api/storage',
        signingSecret: 'x'.repeat(32),
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('keeps uploads and drafts on the server, behind signed API links', async () => {
    await s3.put('assets/a/v1/poster.png', new TextEncoder().encode('png'), 'image/png');
    expect(await s3.head('assets/a/v1/poster.png')).toEqual({ sizeBytes: 3 });
    const upload = new URL(await s3.signedUploadUrl('assets/a/v1/poster.png', 'image/png'));
    expect(upload.href).toMatch(/^https:\/\/api\.test\/api\/storage\/upload\/assets\/a\/v1\/poster\.png\?/);
    expect(await s3.signedReadUrl('assets/a/v1/poster.png')).toMatch(
      /^https:\/\/api\.test\/api\/storage\/read\//,
    );
  });

  it('uploads an approved file to the public bucket with its type', async () => {
    await s3.put('assets/b/v1/song.mp3', new TextEncoder().encode('mp3'), 'audio/mpeg');
    const send = vi.spyOn(S3Client.prototype, 'send').mockImplementation(async (command: unknown) => {
      if (command instanceof HeadObjectCommand)
        throw Object.assign(new Error('missing'), { name: 'NotFound' });
      return {};
    });
    await s3.publish('assets/b/v1/song.mp3', 'audio/mpeg');
    const put = send.mock.calls.map(([command]) => command).find((c) => c instanceof PutObjectCommand);
    expect(put?.input).toMatchObject({
      Bucket: 'public-bucket',
      Key: 'assets/b/v1/song.mp3',
      ContentType: 'audio/mpeg',
      CacheControl: 'public, max-age=31536000, immutable',
    });
    expect(new TextDecoder().decode(put?.input.Body as Uint8Array)).toBe('mp3');
  });

  it('does not upload a file that is already public', async () => {
    const send = vi.spyOn(S3Client.prototype, 'send').mockResolvedValue({} as never);
    await s3.publish('assets/missing/v1/file.png', 'image/png');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('explains when the file to publish is not on the server', async () => {
    vi.spyOn(S3Client.prototype, 'send').mockRejectedValue(
      Object.assign(new Error('missing'), { name: 'NotFound' }),
    );
    await expect(s3.publish('assets/missing/v1/file.png', 'image/png')).rejects.toThrow(/not on the server/);
  });

  it('serves public URLs from the media domain', () => {
    expect(s3.publicUrl('assets/a/v1/poster.png')).toBe('https://media.example.com/assets/a/v1/poster.png');
  });
});
