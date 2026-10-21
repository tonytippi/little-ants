'use client';

import { useQuery } from '@tanstack/react-query';
import { StatusBadge } from '@little-ants/ui/badge';
import { Button } from '@little-ants/ui/button';
import { Card, ErrorNotice, Spinner } from '@little-ants/ui/feedback';
import { api } from '../../lib/api';
import { formatBytes, formatDate, useApiMutation, usePermissions } from '../../lib/hooks';
import type { AssetDetail, ContentStatus } from '../../lib/types';
import { FormError } from '../form-error';
import { AssetPreview } from './asset-preview';
import { UploadButton } from './upload-button';

const NEXT: Record<ContentStatus, { to: ContentStatus; label: string; reviewerOnly?: boolean }[]> = {
  DRAFT: [
    { to: 'REVIEW', label: 'Send for review' },
    { to: 'ARCHIVED', label: 'Archive' },
  ],
  REVIEW: [
    { to: 'APPROVED', label: 'Approve', reviewerOnly: true },
    { to: 'DRAFT', label: 'Back to draft' },
  ],
  APPROVED: [{ to: 'ARCHIVED', label: 'Archive' }],
  ARCHIVED: [{ to: 'DRAFT', label: 'Restore as draft' }],
};

/** Side panel with a large preview, versions and status actions for one file. */
export function AssetDetailPanel({ id, onClose, onOpen }: { id: string; onClose: () => void; onOpen: (id: string) => void }) {
  const { canEdit, canReview } = usePermissions();
  const query = useQuery({ queryKey: ['asset', id], queryFn: () => api.get<AssetDetail>(`/assets/${id}`) });
  const status = useApiMutation((to: ContentStatus) => api.post(`/assets/${id}/status`, { status: to }), [['asset', id], ['assets']]);

  return (
    <Card className="self-start xl:sticky xl:top-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold">File details</h2>
        <Button size="sm" variant="ghost" onClick={onClose} aria-label="Close file details">
          ✕
        </Button>
      </div>
      {query.isPending ? <Spinner label="Loading file" /> : null}
      {query.error ? <ErrorNotice error={query.error} /> : null}
      {query.data ? (
        <div className="flex flex-col gap-3">
          <AssetPreview asset={query.data} size="lg" />
          <p className="break-all font-semibold">{query.data.fileName}</p>
          <dl className="grid grid-cols-[6rem_1fr] gap-1 text-sm">
            <dt className="text-bark-500">Status</dt>
            <dd>
              <StatusBadge status={query.data.status} />
            </dd>
            <dt className="text-bark-500">Version</dt>
            <dd>v{query.data.version}</dd>
            <dt className="text-bark-500">Type</dt>
            <dd>{query.data.mimeType}</dd>
            <dt className="text-bark-500">Size</dt>
            <dd>{formatBytes(query.data.sizeBytes)}</dd>
            <dt className="text-bark-500">Uploaded</dt>
            <dd>
              {formatDate(query.data.createdAt, true)}
              {query.data.uploadedBy ? ` · ${query.data.uploadedBy.name}` : ''}
            </dd>
          </dl>
          <a href={query.data.url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-leaf-700 hover:underline">
            Open file in a new tab
          </a>
          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              {NEXT[query.data.status]
                .filter((item) => !item.reviewerOnly || canReview)
                .map((item) => (
                  <Button
                    key={item.to}
                    size="sm"
                    variant={item.to === 'APPROVED' ? 'primary' : 'secondary'}
                    busy={status.isPending && status.variables === item.to}
                    onClick={() => {
                      if (item.to === 'ARCHIVED' && !window.confirm('Archive this file? It will be left out of new releases.')) return;
                      status.mutate(item.to);
                    }}
                  >
                    {item.label}
                  </Button>
                ))}
            </div>
          ) : null}
          <FormError error={status.error} />
          {canEdit ? (
            <div className="border-t border-cream-200 pt-3">
              <p className="mb-2 text-sm text-bark-500">A new version replaces this file wherever it is used in drafts. Published releases keep the old one.</p>
              <UploadButton size="sm" label="Upload new version" replacesId={query.data.id} accept={query.data.mimeType} onUploaded={([newId]) => newId && onOpen(newId)} />
            </div>
          ) : null}
          {query.data.olderVersions.length ? (
            <div className="border-t border-cream-200 pt-3">
              <h3 className="mb-1 text-sm font-bold">Older versions</h3>
              <ul className="flex flex-col gap-1 text-sm">
                {query.data.olderVersions.map((version) => (
                  <li key={version.id} className="flex items-center justify-between gap-2">
                    <button type="button" className="hover:underline" onClick={() => onOpen(version.id)}>
                      v{version.version} · {formatDate(version.createdAt)}
                    </button>
                    <StatusBadge status={version.status} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
