'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { ASSET_MIME_TYPES } from '@little-ants/shared';
import { uploadAsset } from '@little-ants/ui/lib/api-client';
import { buttonClass } from '@little-ants/ui/button';
import { api } from '../../lib/api';
import { FormError } from '../form-error';

interface UploadButtonProps {
  label?: string;
  multiple?: boolean;
  /** Restrict to one kind of file, e.g. "image/*". */
  accept?: string;
  /** Upload a new version of this asset. */
  replacesId?: string;
  onUploaded?: (assetIds: string[]) => void;
  size?: 'sm' | 'md';
}

const ALL_TYPES = Object.keys(ASSET_MIME_TYPES).join(',');

/** File picker that uploads straight to storage and reports progress per file. */
export function UploadButton({
  label = 'Upload files',
  multiple = true,
  accept = ALL_TYPES,
  replacesId,
  onUploaded,
  size = 'md',
}: UploadButtonProps) {
  const input = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<{ name: string; fraction: number }[]>([]);
  const [error, setError] = useState<unknown>(null);

  async function upload(files: FileList | null): Promise<void> {
    if (!files?.length) return;
    setError(null);
    const list = [...files];
    setProgress(list.map((file) => ({ name: file.name, fraction: 0 })));
    const ids: string[] = [];
    try {
      for (const [index, file] of list.entries()) {
        const result = await uploadAsset(api, file, {
          replacesId,
          onProgress: (fraction) =>
            setProgress((rows) => rows.map((row, i) => (i === index ? { ...row, fraction } : row))),
        });
        ids.push(result.id);
      }
      await queryClient.invalidateQueries({ queryKey: ['assets'] });
      onUploaded?.(ids);
    } catch (caught) {
      setError(caught);
    } finally {
      setProgress([]);
      if (input.current) input.current.value = '';
    }
  }

  const busy = progress.length > 0;
  return (
    <div className="flex flex-col gap-2">
      <label
        className={`${buttonClass('secondary', size)} cursor-pointer ${busy ? 'pointer-events-none opacity-60' : ''}`}
      >
        {busy ? 'Uploading…' : label}
        <input
          ref={input}
          type="file"
          className="sr-only"
          multiple={multiple && !replacesId}
          accept={accept}
          onChange={(event) => void upload(event.target.files)}
          disabled={busy}
        />
      </label>
      {progress.map((row) => (
        <div key={row.name} className="text-xs text-bark-500">
          <span className="block truncate">{row.name}</span>
          <progress className="h-1.5 w-full accent-leaf-600" value={row.fraction} max={1} />
        </div>
      ))}
      {error ? <FormError error={error} /> : null}
    </div>
  );
}
