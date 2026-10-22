'use client';

import { useQuery, type QueryKey } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@little-ants/ui/button';
import { EmptyState, ErrorNotice, Spinner } from '@little-ants/ui/feedback';
import { StatusBadge } from '@little-ants/ui/badge';
import { api } from '../lib/api';
import { formatDate, useApiMutation, usePermissions } from '../lib/hooks';
import type { Revision } from '../lib/types';
import { Dialog } from './dialog';
import { FormError } from './form-error';

type EntityType = 'unit' | 'word' | 'material' | 'lesson';

/** Fields that are bookkeeping, not content. */
const IGNORED = new Set([
  'id',
  'unitId',
  'createdAt',
  'updatedAt',
  'status',
  'version',
  'materialId',
  'lessonId',
]);

function show(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

/** Field-by-field differences between a saved version and the current item. */
export function diffFields(
  snapshot: Record<string, unknown>,
  current: Record<string, unknown>,
): { field: string; before: string; now: string }[] {
  const fields = new Set([...Object.keys(snapshot), ...Object.keys(current)]);
  const rows: { field: string; before: string; now: string }[] = [];
  for (const field of fields) {
    if (IGNORED.has(field) || !(field in snapshot)) continue;
    const before = show(snapshot[field]);
    const now = show(current[field]);
    if (before !== now) rows.push({ field, before, now });
  }
  return rows;
}

interface HistoryButtonProps {
  entityType: EntityType;
  entityId: string;
  /** The item as it is now, to compare older versions against. */
  current: Record<string, unknown>;
  invalidate: QueryKey[];
}

/** "History" button that opens the list of saved versions with a diff and "Restore as new draft". */
export function HistoryButton({ entityType, entityId, current, invalidate }: HistoryButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        History
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="History" wide>
        {open ? (
          <HistoryList
            entityType={entityType}
            entityId={entityId}
            current={current}
            invalidate={invalidate}
            onRestored={() => setOpen(false)}
          />
        ) : null}
      </Dialog>
    </>
  );
}

function HistoryList({
  entityType,
  entityId,
  current,
  invalidate,
  onRestored,
}: HistoryButtonProps & { onRestored: () => void }) {
  const { canEdit } = usePermissions();
  const [selected, setSelected] = useState<string | null>(null);
  const key = ['revisions', entityType, entityId];
  const query = useQuery({
    queryKey: key,
    queryFn: () => api.get<Revision[]>(`/content/revisions?entityType=${entityType}&entityId=${entityId}`),
  });
  const restore = useApiMutation(
    (id: string) => api.post(`/content/revisions/${id}/restore`),
    [...invalidate, key],
  );

  if (query.isPending) return <Spinner label="Loading history" />;
  if (query.error) return <ErrorNotice error={query.error} />;
  if (query.data.length === 0) return <EmptyState title="No saved versions yet" />;

  const revision = query.data.find((item) => item.id === selected) ?? query.data[0]!;
  const diff = diffFields(revision.snapshot, current);

  return (
    <div className="grid gap-4 md:grid-cols-[16rem_1fr]">
      <ol className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto" aria-label="Saved versions">
        {query.data.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => setSelected(item.id)}
              aria-current={item.id === revision.id}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm ${item.id === revision.id ? 'bg-leaf-50 ring-1 ring-leaf-100' : 'hover:bg-cream-100'}`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-semibold">v{item.version}</span>
                <StatusBadge status={String(item.snapshot.status ?? '')} />
              </span>
              <span className="block truncate text-xs text-bark-500">{item.note || 'change'}</span>
              <span className="block text-xs text-bark-500">
                {item.author?.name ?? 'Importer'} · {formatDate(item.createdAt, true)}
              </span>
            </button>
          </li>
        ))}
      </ol>
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-bark-500">
            Differences between v{revision.version} ({revision.note || 'change'}) and the current item
          </p>
          {canEdit ? (
            <Button
              size="sm"
              variant="secondary"
              busy={restore.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    `Restore v${revision.version} as a new draft? The current text is kept in history.`,
                  )
                ) {
                  restore.mutate(revision.id, { onSuccess: onRestored });
                }
              }}
            >
              Restore as new draft
            </Button>
          ) : null}
        </div>
        {restore.error ? <FormError error={restore.error} /> : null}
        {diff.length === 0 ? (
          <EmptyState title="No differences">This version has the same content as now.</EmptyState>
        ) : (
          <table className="w-full table-fixed border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-bark-500">
                <th className="w-32 py-1">Field</th>
                <th className="py-1">In v{revision.version}</th>
                <th className="py-1">Now</th>
              </tr>
            </thead>
            <tbody>
              {diff.map((row) => (
                <tr key={row.field} className="border-t border-cream-200 align-top">
                  <td className="py-2 pr-2 font-semibold">{row.field}</td>
                  <td className="whitespace-pre-wrap break-words bg-ant-50/50 px-2 py-2">{row.before}</td>
                  <td className="whitespace-pre-wrap break-words bg-leaf-50/50 px-2 py-2">{row.now}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
