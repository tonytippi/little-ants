import { Inject, Injectable } from '@nestjs/common';
import type { ContentStatus } from '@little-ants/db';
import type { ObjectStorage } from '@little-ants/storage';
import { OBJECT_STORAGE } from '../storage/storage.tokens.js';

/** URLs for showing assets in Admin: public for approved files, a short-lived signed link otherwise. */
@Injectable()
export class AssetUrls {
  constructor(@Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage) {}

  /** Copy approved files to the public media bucket (call before marking them APPROVED). */
  async publish(assets: { storageKey: string }[]): Promise<void> {
    for (const asset of assets) await this.storage.publish(asset.storageKey);
  }

  viewUrl(asset: { storageKey: string; status: ContentStatus }): Promise<string> {
    return asset.status === 'APPROVED' ? Promise.resolve(this.storage.publicUrl(asset.storageKey)) : this.storage.signedReadUrl(asset.storageKey);
  }

  async withUrl<T extends { storageKey: string; status: ContentStatus }>(asset: T): Promise<T & { url: string }>;
  async withUrl<T extends { storageKey: string; status: ContentStatus }>(asset: T | null): Promise<(T & { url: string }) | null>;
  async withUrl<T extends { storageKey: string; status: ContentStatus }>(asset: T | null): Promise<(T & { url: string }) | null> {
    return asset ? { ...asset, url: await this.viewUrl(asset) } : null;
  }
}
