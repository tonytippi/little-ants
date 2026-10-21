'use client';

import { useState } from 'react';
import { Button } from '@little-ants/ui/button';
import { TextArea } from '@little-ants/ui/field';
import { api } from '../../lib/api';
import { useApiMutation, usePermissions } from '../../lib/hooks';
import type { LinkedAsset, MaterialDetail } from '../../lib/types';
import { AssetPicker } from '../assets/asset-picker';
import { AssetView } from '../assets/asset-view';
import { FormError } from '../form-error';

interface PageDraft {
  key: string;
  text: string;
  image: LinkedAsset | null;
  audio: LinkedAsset | null;
}

let counter = 0;
const newKey = (): string => `page-${(counter += 1)}`;

/** Edit, add, remove and reorder pages; each page has text, a picture and audio. Saved as one revision. */
export function PagesEditor({ material }: { material: MaterialDetail }) {
  const { canEdit } = usePermissions();
  const [pages, setPages] = useState<PageDraft[]>(() =>
    material.pages.map((page) => ({ key: newKey(), text: page.text, image: page.imageAsset, audio: page.audioAsset })),
  );
  const [picker, setPicker] = useState<{ index: number; kind: 'IMAGE' | 'AUDIO' } | null>(null);
  const [dirty, setDirty] = useState(false);
  const save = useApiMutation(
    () =>
      api.put(`/content/materials/${material.id}/pages`, {
        pages: pages.map((page) => ({ text: page.text, imageAssetId: page.image?.id ?? null, audioAssetId: page.audio?.id ?? null })),
      }),
    [['material', material.id], ['unit', material.unit.code]],
  );

  const update = (index: number, patch: Partial<PageDraft>): void => {
    setDirty(true);
    setPages((current) => current.map((page, i) => (i === index ? { ...page, ...patch } : page)));
  };
  const move = (index: number, delta: number): void => {
    const target = index + delta;
    if (target < 0 || target >= pages.length) return;
    setDirty(true);
    setPages((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  };

  async function pick(ids: string[]): Promise<void> {
    if (!picker || !ids[0]) return;
    const asset = await api.get<LinkedAsset>(`/assets/${ids[0]}`);
    update(picker.index, picker.kind === 'IMAGE' ? { image: asset } : { audio: asset });
  }

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-3">
        {pages.map((page, index) => (
          <li key={page.key} className="grid gap-3 rounded-xl bg-cream-50 p-3 ring-1 ring-cream-200 md:grid-cols-[3rem_1fr_10rem]">
            <div className="flex flex-row items-center gap-1 md:flex-col">
              <span className="text-lg font-extrabold text-bark-500">{index + 1}</span>
              {canEdit ? (
                <>
                  <Button size="sm" variant="ghost" aria-label={`Move page ${index + 1} up`} disabled={index === 0} onClick={() => move(index, -1)}>
                    ↑
                  </Button>
                  <Button size="sm" variant="ghost" aria-label={`Move page ${index + 1} down`} disabled={index === pages.length - 1} onClick={() => move(index, 1)}>
                    ↓
                  </Button>
                </>
              ) : null}
            </div>
            <TextArea
              aria-label={`Page ${index + 1} text`}
              rows={3}
              className="font-child text-base"
              value={page.text}
              disabled={!canEdit}
              onChange={(event) => update(index, { text: event.target.value })}
            />
            <div className="flex flex-col gap-2">
              {page.image ? <AssetView asset={page.image} size="sm" /> : <span className="text-xs text-bark-500">No picture</span>}
              {page.audio ? <AssetView asset={page.audio} /> : null}
              {canEdit ? (
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" variant="secondary" onClick={() => setPicker({ index, kind: 'IMAGE' })}>
                    {page.image ? 'Picture…' : '+ Picture'}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setPicker({ index, kind: 'AUDIO' })}>
                    {page.audio ? 'Audio…' : '+ Audio'}
                  </Button>
                  {page.image || page.audio ? (
                    <Button size="sm" variant="ghost" onClick={() => update(index, { image: null, audio: null })}>
                      Clear files
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      if (!window.confirm(`Remove page ${index + 1}?`)) return;
                      setDirty(true);
                      setPages((current) => current.filter((_, i) => i !== index));
                    }}
                  >
                    Remove
                  </Button>
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      {canEdit ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDirty(true);
              setPages((current) => [...current, { key: newKey(), text: '', image: null, audio: null }]);
            }}
          >
            + Add page
          </Button>
          <Button size="sm" busy={save.isPending} disabled={!dirty} onClick={() => save.mutate(undefined, { onSuccess: () => setDirty(false) })}>
            Save pages
          </Button>
          {dirty ? <span className="text-xs text-ant-600">Unsaved changes</span> : null}
        </div>
      ) : null}
      <FormError error={save.error} />
      <AssetPicker
        open={picker !== null}
        onClose={() => setPicker(null)}
        kind={picker?.kind}
        unitCode={material.unit.code}
        title={picker ? `${picker.kind === 'IMAGE' ? 'Picture' : 'Audio'} for page ${picker.index + 1}` : ''}
        onPick={(ids) => void pick(ids)}
      />
    </div>
  );
}
