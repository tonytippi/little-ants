import type { Asset } from '../../lib/types';

/** Small visual for an asset: image thumbnail, audio player or a file link. */
export function AssetPreview({
  asset,
  size = 'md',
}: {
  asset: Pick<Asset, 'kind' | 'url' | 'fileName' | 'mimeType'>;
  size?: 'sm' | 'md' | 'lg';
}) {
  const box = size === 'sm' ? 'h-14 w-20' : size === 'lg' ? 'h-64 w-full' : 'h-32 w-full';
  if (asset.kind === 'IMAGE') {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- files come from storage with signed URLs
      <img
        src={asset.url}
        alt={asset.fileName}
        loading="lazy"
        className={`${box} rounded-lg bg-cream-100 object-contain`}
      />
    );
  }
  if (asset.kind === 'AUDIO') {
    return <audio controls preload="none" src={asset.url} className="w-full" aria-label={asset.fileName} />;
  }
  if (asset.kind === 'VIDEO') {
    return (
      <video
        controls
        preload="none"
        src={asset.url}
        className={`${box} rounded-lg bg-bark-900`}
        aria-label={asset.fileName}
      />
    );
  }
  return (
    <a
      href={asset.url}
      target="_blank"
      rel="noreferrer"
      className={`${box} flex flex-col items-center justify-center rounded-lg bg-ant-50 text-xs font-bold text-ant-700 hover:bg-ant-100`}
    >
      <span className="text-lg">PDF</span>
      <span className="underline">Open</span>
    </a>
  );
}
