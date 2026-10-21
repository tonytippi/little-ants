'use client';

import { useState } from 'react';
import { Button } from '@little-ants/ui/button';
import { formatBytes } from '../lib/format';
import { useOnline } from '../lib/hooks';
import { downloadUnit, removeUnit, type DownloadProgress } from '../lib/media-cache';
import { useRefreshDownloads } from '../lib/queries';
import { downloadState } from '../lib/release-diff';

interface Props {
  code: string;
  localVersion?: number;
  latestVersion?: number;
  mediaBytes?: number;
  compact?: boolean;
}

/** Download a unit (lessons + pictures + audio) for offline teaching, update it, or remove it. */
export function DownloadButton({ code, localVersion, latestVersion, mediaBytes, compact = false }: Props) {
  const online = useOnline();
  const refresh = useRefreshDownloads();
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const state = downloadState(localVersion, latestVersion);

  async function run(): Promise<void> {
    setError(null);
    try {
      await downloadUnit(code, setProgress);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Download failed');
    } finally {
      setProgress(null);
      refresh();
    }
  }

  if (state.kind === 'not-published') return <span className="text-sm text-bark-500">Not published yet</span>;

  if (progress) {
    const percent = progress.totalBytes
      ? Math.round((progress.bytes / progress.totalBytes) * 100)
      : Math.round((progress.done / Math.max(1, progress.total)) * 100);
    return (
      <div className="min-w-48" role="status" aria-live="polite">
        <div className="flex justify-between text-xs font-semibold text-bark-700">
          <span>Downloading {code}…</span>
          <span>
            {progress.done}/{progress.total} files · {formatBytes(progress.totalBytes)}
          </span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-cream-200">
          <div className="h-full bg-leaf-500 transition-all" style={{ width: `${percent}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {state.kind === 'not-downloaded' ? (
        <Button
          size={compact ? 'sm' : 'md'}
          variant="secondary"
          disabled={!online}
          onClick={() => void run()}
        >
          ⬇ Download for offline
        </Button>
      ) : null}
      {state.kind === 'update-available' ? (
        <Button size={compact ? 'sm' : 'md'} variant="accent" disabled={!online} onClick={() => void run()}>
          Update to v{state.latest}
        </Button>
      ) : null}
      {state.kind === 'up-to-date' ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-leaf-50 px-2.5 py-1 text-xs font-semibold text-leaf-700">
          ✓ Offline ready · v{state.version}
          {mediaBytes ? ` · ${formatBytes(mediaBytes)}` : ''}
        </span>
      ) : null}
      {localVersion !== undefined && !compact ? (
        <button
          type="button"
          className="text-xs font-semibold text-bark-500 underline hover:text-ant-600"
          onClick={() => {
            if (window.confirm(`Remove ${code} from this device? You can download it again later.`))
              void removeUnit(code).then(refresh);
          }}
        >
          Remove
        </button>
      ) : null}
      {error ? (
        <span role="alert" className="text-xs font-semibold text-ant-600">
          {error}
        </span>
      ) : null}
    </div>
  );
}
