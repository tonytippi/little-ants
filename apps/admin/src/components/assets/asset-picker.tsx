'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@little-ants/ui/button';
import { StatusBadge } from '@little-ants/ui/badge';
import { EmptyState, ErrorNotice, Spinner } from '@little-ants/ui/feedback';
import { TextInput } from '@little-ants/ui/field';
import { api } from '../../lib/api';
import type { Asset, AssetListItem } from '../../lib/types';
import { Dialog } from '../dialog';
import { AssetPreview } from './asset-preview';
import { UploadButton } from './upload-button';

type Kind = Asset['kind'];

const ACCEPT: Record<Kind, string> = {
  IMAGE: 'image/png,image/jpeg,image/webp,image/svg+xml',
  AUDIO: 'audio/mpeg,audio/mp4,audio/aac,audio/wav',
  VIDEO: 'video/mp4',
  PDF: 'application/pdf',
};

interface AssetPickerProps {
  open: boolean;
  onClose: () => void;
  onPick: (assetIds: string[]) => void;
  kind?: Kind;
  unitCode?: string;
  multiple?: boolean;
  title?: string;
}

/** Choose existing files (filtered to this unit by default) or upload new ones. */
export function AssetPicker({
  open,
  onClose,
  onPick,
  kind,
  unitCode,
  multiple = false,
  title = 'Choose a file',
}: AssetPickerProps) {
  return (
    <Dialog open={open} onClose={onClose} title={title} wide>
      {open ? (
        <PickerBody onPick={onPick} kind={kind} unitCode={unitCode} multiple={multiple} onClose={onClose} />
      ) : null}
    </Dialog>
  );
}

function PickerBody({ onPick, onClose, kind, unitCode, multiple }: Omit<AssetPickerProps, 'open' | 'title'>) {
  const [search, setSearch] = useState('');
  const [onlyUnit, setOnlyUnit] = useState(Boolean(unitCode));
  const [chosen, setChosen] = useState<string[]>([]);
  const params = new URLSearchParams({ take: '120' });
  if (kind) params.set('kind', kind);
  if (search) params.set('q', search);
  if (onlyUnit && unitCode) params.set('unit', unitCode);
  const query = useQuery({
    queryKey: ['assets', 'picker', params.toString()],
    queryFn: () => api.get<{ total: number; assets: AssetListItem[] }>(`/assets?${params.toString()}`),
  });

  function toggle(id: string): void {
    if (!multiple) {
      onPick([id]);
      onClose();
      return;
    }
    setChosen((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <TextInput
          type="search"
          placeholder="Search file names"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Search file names"
          className="max-w-xs"
        />
        {unitCode ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={onlyUnit}
              onChange={(event) => setOnlyUnit(event.target.checked)}
            />
            Only files used in {unitCode}
          </label>
        ) : null}
        <div className="ml-auto">
          <UploadButton
            size="sm"
            label="Upload new"
            multiple={multiple}
            accept={kind ? ACCEPT[kind] : undefined}
            onUploaded={(ids) => {
              if (!multiple && ids[0]) {
                onPick([ids[0]]);
                onClose();
              } else setChosen((current) => [...current, ...ids]);
            }}
          />
        </div>
      </div>
      {query.isPending ? <Spinner label="Loading files" /> : null}
      {query.error ? <ErrorNotice error={query.error} /> : null}
      {query.data && query.data.assets.length === 0 ? (
        <EmptyState title="No files found">Upload a file or change the filters.</EmptyState>
      ) : null}
      {query.data ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {query.data.assets.map((asset) => {
            const isChosen = chosen.includes(asset.id);
            return (
              <li key={asset.id}>
                <div
                  className={`flex h-full flex-col gap-2 rounded-xl border p-2 ${isChosen ? 'border-leaf-600 ring-2 ring-leaf-100' : 'border-cream-200'}`}
                >
                  <AssetPreview asset={asset} />
                  <p className="truncate text-xs font-semibold" title={asset.fileName}>
                    {asset.fileName}
                  </p>
                  <div className="mt-auto flex items-center justify-between gap-1">
                    <StatusBadge status={asset.status} />
                    <Button
                      size="sm"
                      variant={isChosen ? 'primary' : 'secondary'}
                      onClick={() => toggle(asset.id)}
                      aria-pressed={multiple ? isChosen : undefined}
                    >
                      {multiple ? (isChosen ? 'Chosen' : 'Choose') : 'Use'}
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
      {multiple ? (
        <div className="flex justify-end gap-2 border-t border-cream-200 pt-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onPick(chosen);
              onClose();
            }}
          >
            Use {chosen.length} file{chosen.length === 1 ? '' : 's'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
