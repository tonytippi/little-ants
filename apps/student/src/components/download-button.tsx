'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@little-ants/ui/button';
import { downloadUnit, type DownloadProgress, type LoadedUnit, type PayloadSource } from '../lib/media-cache';
import { DownloadIcon } from './icons';

/** "Download for offline": saves the unit's leaves and every picture and recording on the device. */
export function DownloadButton({ source, unit }: { source: PayloadSource; unit: LoadedUnit }) {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = async (): Promise<void> => {
    setError(null);
    setProgress({ done: 0, total: 0 });
    try {
      await downloadUnit(source, setProgress);
      await queryClient.invalidateQueries({ queryKey: ['unit'] });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Download failed');
    } finally {
      setProgress(null);
    }
  };

  if (progress)
    return (
      <span role="status" className="text-sm font-semibold text-bark-500">
        Downloading {progress.done} / {progress.total || '…'}
      </span>
    );
  if (unit.downloaded && !unit.outdated)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-leaf-50 px-3 py-1.5 text-sm font-semibold text-leaf-700">
        ✓ Saved for offline · Đã tải về máy
      </span>
    );
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button variant="secondary" onClick={() => void start()} disabled={unit.offline}>
        <DownloadIcon className="size-4" />
        {unit.outdated ? 'Update download · Cập nhật' : 'Download for offline · Tải về máy'}
      </Button>
      {error ? (
        <span role="alert" className="text-sm text-ant-700">
          {error}
        </span>
      ) : null}
    </span>
  );
}
