'use client';

import Link from 'next/link';
import { useState } from 'react';
import { StatusBadge } from '@little-ants/ui/badge';
import { Button } from '@little-ants/ui/button';
import { Card } from '@little-ants/ui/feedback';
import { api } from '../../lib/api';
import { useApiMutation, usePermissions } from '../../lib/hooks';
import type { Asset, MaterialDetail } from '../../lib/types';
import { AssetPicker } from '../assets/asset-picker';
import { AssetView } from '../assets/asset-view';
import { FormError } from '../form-error';

const ROLES: { role: string; label: string; hint: string; kind?: Asset['kind'] }[] = [
  { role: 'poster', label: 'Poster / picture', hint: 'Shown full screen in class.', kind: 'IMAGE' },
  { role: 'audio', label: 'Audio', hint: 'Song, chant or story recording.', kind: 'AUDIO' },
  { role: 'video', label: 'Video', hint: 'Read-along or demo video.', kind: 'VIDEO' },
  { role: 'print', label: 'Print file', hint: 'Final print-ready PDF.', kind: 'PDF' },
  { role: 'draft-layout', label: 'Draft layout', hint: 'Working PDF from the design team.', kind: 'PDF' },
];

/** Files attached to the material, grouped by what they are used for. */
export function MaterialFiles({ material }: { material: MaterialDetail }) {
  const { canEdit } = usePermissions();
  const [picking, setPicking] = useState<(typeof ROLES)[number] | null>(null);
  const setFiles = useApiMutation(
    ({ role, assetIds }: { role: string; assetIds: string[] }) => api.put(`/content/materials/${material.id}/assets`, { role, assetIds }),
    [['material', material.id], ['unit', material.unit.code]],
  );
  const idsFor = (role: string): string[] => material.assets.filter((link) => link.role === role).map((link) => link.assetId);

  return (
    <Card>
      <h2 className="mb-3 font-bold">Files</h2>
      <div className="flex flex-col gap-5">
        {ROLES.map((role) => {
          const links = material.assets.filter((link) => link.role === role.role);
          if (!canEdit && links.length === 0) return null;
          return (
            <section key={role.role} aria-labelledby={`role-${role.role}`}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <h3 id={`role-${role.role}`} className="text-sm font-bold">
                    {role.label}
                  </h3>
                  <p className="text-xs text-bark-500">{role.hint}</p>
                </div>
                {canEdit ? (
                  <Button size="sm" variant="secondary" onClick={() => setPicking(role)}>
                    + Add
                  </Button>
                ) : null}
              </div>
              <ul className="grid grid-cols-2 gap-2">
                {links.map((link) => (
                  <li key={link.id} className="flex flex-col gap-1 rounded-lg bg-cream-50 p-2 ring-1 ring-cream-200">
                    <AssetView asset={link.asset} />
                    <Link href={`/assets?open=${link.asset.id}`} className="truncate text-xs font-semibold hover:underline" title={link.asset.fileName}>
                      {link.asset.fileName}
                    </Link>
                    <div className="flex items-center justify-between">
                      <StatusBadge status={link.asset.status} />
                      {canEdit ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Remove ${link.asset.fileName}`}
                          onClick={() => setFiles.mutate({ role: role.role, assetIds: idsFor(role.role).filter((id) => id !== link.assetId) })}
                        >
                          ✕
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      <FormError error={setFiles.error} />
      <AssetPicker
        open={picking !== null}
        onClose={() => setPicking(null)}
        kind={picking?.kind}
        unitCode={material.unit.code}
        multiple
        title={picking ? `${picking.label} for ${material.code}` : ''}
        onPick={(ids) => picking && setFiles.mutate({ role: picking.role, assetIds: [...new Set([...idsFor(picking.role), ...ids])] })}
      />
    </Card>
  );
}
