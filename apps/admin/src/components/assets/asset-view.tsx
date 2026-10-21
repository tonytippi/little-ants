'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { Asset, AssetDetail } from '../../lib/types';
import { AssetPreview } from './asset-preview';

type MaybeUrl = Omit<Asset, 'url'> & { url?: string };

/**
 * Preview an asset that may come without a view URL (material and page links do not include one);
 * the URL is then fetched from /assets/:id.
 */
export function AssetView({ asset, size }: { asset: MaybeUrl; size?: 'sm' | 'md' | 'lg' }) {
  const detail = useQuery({
    queryKey: ['asset', asset.id],
    queryFn: () => api.get<AssetDetail>(`/assets/${asset.id}`),
    enabled: !asset.url,
    staleTime: 30 * 60_000,
  });
  const url = asset.url ?? detail.data?.url;
  if (!url) return <div className={`${size === 'sm' ? 'h-14 w-20' : 'h-32 w-full'} animate-pulse rounded-lg bg-cream-100`} aria-label={`Loading ${asset.fileName}`} />;
  return <AssetPreview asset={{ ...asset, url }} size={size} />;
}
