'use client';

import Link from 'next/link';
import { useState } from 'react';
import { StatusBadge } from '@little-ants/ui/badge';
import { Button } from '@little-ants/ui/button';
import { Card } from '@little-ants/ui/feedback';
import { TextInput } from '@little-ants/ui/field';
import { api } from '../../lib/api';
import { useApiMutation, usePermissions } from '../../lib/hooks';
import type { UnitDetail, UnitPicture } from '../../lib/types';
import { AssetPicker } from '../assets/asset-picker';
import { AssetView } from '../assets/asset-view';
import { FormError } from '../form-error';

type Role = UnitPicture['role'];
type Item = { assetId: string; label: string };

/** The unit cover and the places the unit happens in; teachers see them on the unit page. */
export function UnitPictures({ unit }: { unit: UnitDetail }) {
  const { canEdit } = usePermissions();
  const [picking, setPicking] = useState<Role | null>(null);
  const save = useApiMutation(
    ({ role, items }: { role: Role; items: Item[] }) =>
      api.put(`/content/units/${unit.code}/pictures`, { role, items }),
    [['unit', unit.code]],
  );
  const itemsFor = (role: Role): Item[] =>
    unit.pictures
      .filter((picture) => picture.role === role)
      .map((picture) => ({ assetId: picture.assetId, label: picture.label }));
  const cover = unit.pictures.find((picture) => picture.role === 'cover');
  const places = unit.pictures.filter((picture) => picture.role === 'place');

  return (
    <Card className="self-start">
      <h2 className="mb-1 font-bold">Unit pictures</h2>
      <p className="mb-3 text-sm text-bark-500">
        The cover and the places of the unit, shown to teachers on the unit page.
      </p>

      <section aria-labelledby="unit-cover" className="mb-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 id="unit-cover" className="text-sm font-bold">
            Cover
          </h3>
          {canEdit ? (
            <Button size="sm" variant="secondary" onClick={() => setPicking('cover')}>
              {cover ? 'Change' : '+ Add'}
            </Button>
          ) : null}
        </div>
        {cover ? (
          <PictureCard
            picture={cover}
            onRemove={canEdit ? () => save.mutate({ role: 'cover', items: [] }) : undefined}
          />
        ) : (
          <p className="text-xs text-bark-500">No cover yet.</p>
        )}
      </section>

      <section aria-labelledby="unit-places">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 id="unit-places" className="text-sm font-bold">
            Places
          </h3>
          {canEdit ? (
            <Button size="sm" variant="secondary" onClick={() => setPicking('place')}>
              + Add
            </Button>
          ) : null}
        </div>
        {places.length === 0 ? <p className="text-xs text-bark-500">No places yet.</p> : null}
        <ul className="grid grid-cols-2 gap-2">
          {places.map((place) => (
            <li key={place.id}>
              <PictureCard
                picture={place}
                onRename={
                  canEdit
                    ? (label) =>
                        save.mutate({
                          role: 'place',
                          items: itemsFor('place').map((item) =>
                            item.assetId === place.assetId ? { ...item, label } : item,
                          ),
                        })
                    : undefined
                }
                onRemove={
                  canEdit
                    ? () =>
                        save.mutate({
                          role: 'place',
                          items: itemsFor('place').filter((item) => item.assetId !== place.assetId),
                        })
                    : undefined
                }
              />
            </li>
          ))}
        </ul>
      </section>
      <FormError error={save.error} />

      <AssetPicker
        open={picking !== null}
        onClose={() => setPicking(null)}
        kind="IMAGE"
        unitCode={unit.code}
        multiple={picking === 'place'}
        title={picking === 'cover' ? `Cover for ${unit.code}` : `Places for ${unit.code}`}
        onPick={(ids) => {
          if (picking === 'cover')
            save.mutate({ role: 'cover', items: ids.slice(0, 1).map((assetId) => ({ assetId, label: '' })) });
          if (picking === 'place') {
            const current = itemsFor('place');
            const added = ids
              .filter((id) => !current.some((item) => item.assetId === id))
              .map((assetId) => ({ assetId, label: '' }));
            save.mutate({ role: 'place', items: [...current, ...added] });
          }
        }}
      />
    </Card>
  );
}

function PictureCard({
  picture,
  onRename,
  onRemove,
}: {
  picture: UnitPicture;
  onRename?: (label: string) => void;
  onRemove?: () => void;
}) {
  const [label, setLabel] = useState(picture.label);
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-cream-50 p-2 ring-1 ring-cream-200">
      <AssetView asset={picture.asset} />
      <Link
        href={`/assets?open=${picture.asset.id}`}
        className="truncate text-xs font-semibold hover:underline"
        title={picture.asset.fileName}
      >
        {picture.asset.fileName}
      </Link>
      {onRename ? (
        <TextInput
          aria-label={`Name of ${picture.asset.fileName}`}
          placeholder="Name, e.g. garden"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          onBlur={() => label.trim() !== picture.label && onRename(label.trim())}
          className="text-xs"
        />
      ) : picture.role === 'place' ? (
        <p className="text-xs text-bark-700">{picture.label || '—'}</p>
      ) : null}
      <div className="flex items-center justify-between">
        <StatusBadge status={picture.asset.status} />
        {onRemove ? (
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Remove ${picture.asset.fileName}`}
            onClick={onRemove}
          >
            ✕
          </Button>
        ) : null}
      </div>
    </div>
  );
}
