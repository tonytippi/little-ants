import { readFile } from 'node:fs/promises';
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { LocalStorage } from './local-storage.js';
import type { ObjectStorage, StoredObjectInfo } from './types.js';

export interface S3StorageOptions {
  endpoint: string;
  region: string;
  /** Public bucket behind the media domain. It only ever holds approved files. */
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Public media domain for approved files, e.g. https://media.example.com */
  publicBaseUrl: string;
  /** MinIO needs path-style URLs; R2 works with either. */
  forcePathStyle?: boolean;
}

/**
 * Production storage: every file (drafts included) lives on the server's disk, and Cloudflare R2 (or any
 * S3-compatible store) serves only what users get. `publish` uploads an approved file to the public bucket,
 * so drafts never leave the server. The originals come from Google Drive, so the disk copy needs no backup.
 */
export class S3Storage implements ObjectStorage {
  readonly driver = 's3' as const;
  private readonly client: S3Client;

  constructor(
    private readonly options: S3StorageOptions,
    /** Private files on the server's disk, served by the API through signed links. */
    readonly files: LocalStorage,
  ) {
    this.client = new S3Client({
      endpoint: options.endpoint,
      region: options.region,
      forcePathStyle: options.forcePathStyle ?? false,
      credentials: { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey },
    });
  }

  put(key: string, body: Uint8Array, contentType: string): Promise<void> {
    return this.files.put(key, body, contentType);
  }

  head(key: string): Promise<StoredObjectInfo | null> {
    return this.files.head(key);
  }

  delete(key: string): Promise<void> {
    return this.files.delete(key);
  }

  signedUploadUrl(key: string, contentType: string, expiresInSeconds?: number): Promise<string> {
    return this.files.signedUploadUrl(key, contentType, expiresInSeconds);
  }

  signedReadUrl(key: string, expiresInSeconds?: number): Promise<string> {
    return this.files.signedReadUrl(key, expiresInSeconds);
  }

  async publish(key: string, contentType: string): Promise<void> {
    // Keys are never reused, so a file already in the public bucket is the same file.
    if (await this.isPublic(key)) return;
    let body: Buffer;
    try {
      body = await readFile(this.files.filePath(key));
    } catch (error) {
      throw new Error(`Cannot publish ${key}: the file is not on the server (import or upload it again)`, {
        cause: error,
      });
    }
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.options.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
  }

  publicUrl(key: string): string {
    return `${this.options.publicBaseUrl.replace(/\/$/, '')}/${key.split('/').map(encodeURIComponent).join('/')}`;
  }

  private async isPublic(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.options.bucket, Key: key }));
      return true;
    } catch (error) {
      if ((error as { name?: string }).name === 'NotFound') return false;
      throw error;
    }
  }
}
