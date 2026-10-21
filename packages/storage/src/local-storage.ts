import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ObjectStorage, StoredObjectInfo } from './types.js';

export interface LocalStorageOptions {
  /** Folder that holds the files. */
  rootDir: string;
  /** Base URL of the API route that serves and accepts local files, e.g. http://localhost:3001/storage */
  baseUrl: string;
  /** Secret used to sign local URLs. */
  signingSecret: string;
}

export type LocalUrlAction = 'read' | 'upload';

/**
 * Development storage on the local disk. URLs point at the API, which checks the signature
 * before serving or accepting a file, so local URLs behave like presigned S3 URLs.
 */
export class LocalStorage implements ObjectStorage {
  readonly driver = 'local' as const;

  constructor(private readonly options: LocalStorageOptions) {}

  filePath(key: string): string {
    const root = path.resolve(this.options.rootDir);
    const target = path.resolve(root, key);
    if (!target.startsWith(root + path.sep)) {
      throw new Error('Invalid storage key');
    }
    return target;
  }

  async put(key: string, body: Uint8Array, _contentType?: string): Promise<void> {
    const target = this.filePath(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
  }

  async head(key: string): Promise<StoredObjectInfo | null> {
    try {
      const info = await stat(this.filePath(key));
      return { sizeBytes: info.size };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.filePath(key), { force: true });
  }

  async signedUploadUrl(key: string, contentType: string, expiresInSeconds = 900): Promise<string> {
    return this.signedUrl('upload', key, expiresInSeconds, contentType);
  }

  async signedReadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    return this.signedUrl('read', key, expiresInSeconds);
  }

  /** The API's public route serves only approved assets, so nothing needs copying. */
  async publish(_key: string): Promise<void> {}

  publicUrl(key: string): string {
    return `${this.options.baseUrl}/public/${encodeKey(key)}`;
  }

  /** Check a signature produced by signedReadUrl or signedUploadUrl. */
  verify(action: LocalUrlAction, key: string, expires: number, signature: string, contentType = ''): boolean {
    if (!Number.isFinite(expires) || expires * 1000 < Date.now()) return false;
    const expected = Buffer.from(this.sign(action, key, expires, contentType));
    const given = Buffer.from(signature);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }

  private signedUrl(action: LocalUrlAction, key: string, expiresInSeconds: number, contentType = ''): string {
    const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const signature = this.sign(action, key, expires, contentType);
    const query = new URLSearchParams({ expires: String(expires), signature });
    return `${this.options.baseUrl}/${action}/${encodeKey(key)}?${query.toString()}`;
  }

  private sign(action: LocalUrlAction, key: string, expires: number, contentType: string): string {
    return createHmac('sha256', this.options.signingSecret)
      .update(`${action}\n${key}\n${expires}\n${contentType}`)
      .digest('base64url');
  }
}

function encodeKey(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/');
}
