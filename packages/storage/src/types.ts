export interface StoredObjectInfo {
  sizeBytes: number;
}

/**
 * Object storage for curriculum assets.
 * Production uses Cloudflare R2 (S3 API); development can use MinIO or a local folder.
 */
export interface ObjectStorage {
  readonly driver: 'local' | 's3';
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  head(key: string): Promise<StoredObjectInfo | null>;
  delete(key: string): Promise<void>;
  /** URL a browser can PUT the file to directly. With `sizeBytes`, the upload must be exactly that size. */
  signedUploadUrl(
    key: string,
    contentType: string,
    expiresInSeconds?: number,
    sizeBytes?: number,
  ): Promise<string>;
  /** Short-lived URL for private (not yet approved) files. */
  signedReadUrl(key: string, expiresInSeconds?: number): Promise<string>;
  /** Make an approved file reachable at publicUrl(key). Drafts stay private until then. */
  publish(key: string): Promise<void>;
  /** Cacheable URL for approved files served from the media domain. */
  publicUrl(key: string): string;
}

/** Object key for one version of an asset. Keys are never reused, so public URLs can be cached forever. */
export function assetStorageKey(assetId: string, version: number, fileName: string): string {
  const safeName = fileName
    .normalize('NFKD')
    .replaceAll(/[^\w.-]+/g, '-')
    .replaceAll(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `assets/${assetId}/v${version}/${safeName || 'file'}`;
}
