import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { ObjectStorage, StoredObjectInfo } from './types.js';

export interface S3StorageOptions {
  endpoint: string;
  region: string;
  /** Private bucket: every upload lands here. */
  bucket: string;
  /** Public bucket behind the media domain: approved files are copied here. */
  publicBucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Public media domain for approved files, e.g. https://media.example.com */
  publicBaseUrl: string;
  /** MinIO needs path-style URLs; R2 works with either. */
  forcePathStyle?: boolean;
}

/**
 * Cloudflare R2 (or any S3-compatible store such as MinIO).
 * Drafts never become public: only `publish` copies a file into the bucket served by the media domain.
 */
export class S3Storage implements ObjectStorage {
  readonly driver = 's3' as const;
  private readonly client: S3Client;

  constructor(private readonly options: S3StorageOptions) {
    this.client = new S3Client({
      endpoint: options.endpoint,
      region: options.region,
      forcePathStyle: options.forcePathStyle ?? false,
      credentials: { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey },
    });
  }

  async put(key: string, body: Uint8Array, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.options.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        // Keys are versioned and never reused.
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
  }

  async head(key: string): Promise<StoredObjectInfo | null> {
    try {
      const result = await this.client.send(new HeadObjectCommand({ Bucket: this.options.bucket, Key: key }));
      return { sizeBytes: result.ContentLength ?? 0 };
    } catch (error) {
      if ((error as { name?: string }).name === 'NotFound') return null;
      throw error;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.options.bucket, Key: key }));
  }

  signedUploadUrl(key: string, contentType: string, expiresInSeconds = 900, sizeBytes?: number): Promise<string> {
    // Signing ContentLength makes R2 reject an upload of any other size.
    return getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.options.bucket, Key: key, ContentType: contentType, ContentLength: sizeBytes }),
      { expiresIn: expiresInSeconds, signableHeaders: sizeBytes ? new Set(['content-length', 'content-type']) : undefined },
    );
  }

  async publish(key: string): Promise<void> {
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.options.publicBucket,
        Key: key,
        CopySource: `${this.options.bucket}/${key.split('/').map(encodeURIComponent).join('/')}`,
        MetadataDirective: 'COPY',
      }),
    );
  }

  signedReadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.options.bucket, Key: key }), {
      expiresIn: expiresInSeconds,
    });
  }

  publicUrl(key: string): string {
    return `${this.options.publicBaseUrl.replace(/\/$/, '')}/${key.split('/').map(encodeURIComponent).join('/')}`;
  }
}
