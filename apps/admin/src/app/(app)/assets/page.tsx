'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { StatusBadge } from '@little-ants/ui/badge';
import { Button } from '@little-ants/ui/button';
import { EmptyState, ErrorNotice, Spinner } from '@little-ants/ui/feedback';
import { Select, TextInput } from '@little-ants/ui/field';
import { AssetDetailPanel } from '../../../components/assets/asset-detail';
import { AssetPreview } from '../../../components/assets/asset-preview';
import { UploadButton } from '../../../components/assets/upload-button';
import { FormError } from '../../../components/form-error';
import { PageHeader } from '../../../components/page-header';
import { api } from '../../../lib/api';
import { formatBytes, humanize, useApiMutation, usePermissions } from '../../../lib/hooks';
import type { AssetListItem, UnitSummary } from '../../../lib/types';

const PAGE_SIZE = 60;

export default function AssetsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canEdit, canReview } = usePermissions();
  const [unit, setUnit] = useState('');
  const [kind, setKind] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const openId = searchParams.get('open');

  const params = new URLSearchParams({ take: String(PAGE_SIZE), skip: String(page * PAGE_SIZE) });
  if (unit) params.set('unit', unit);
  if (kind) params.set('kind', kind);
  if (status) params.set('status', status);
  if (search) params.set('q', search);
  const query = useQuery({
    queryKey: ['assets', 'library', params.toString()],
    queryFn: () => api.get<{ total: number; assets: AssetListItem[] }>(`/assets?${params.toString()}`),
  });
  const units = useQuery({
    queryKey: ['units'],
    queryFn: () => api.get<{ units: UnitSummary[] }>('/content/units'),
  });
  const bulk = useApiMutation(
    (to: 'REVIEW' | 'APPROVED') =>
      api.post<{ updated: number; skipped: number }>('/assets/status', { ids: selected, status: to }),
    [['assets']],
  );

  const resetPage = (): void => {
    setPage(0);
    setSelected([]);
  };
  const open = (id: string | null): void =>
    router.replace(id ? `/assets?open=${id}` : '/assets', { scroll: false });
  const toggle = (id: string): void =>
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );

  return (
    <div>
      <PageHeader title="Assets" actions={canEdit ? <UploadButton /> : null}>
        Pictures, audio, video and PDFs. Approved files are public and never change; uploading a new version
        keeps the old one.
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <TextInput
          type="search"
          aria-label="Search file names"
          placeholder="Search file names"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            resetPage();
          }}
          className="w-56"
        />
        <Select
          aria-label="Unit"
          value={unit}
          onChange={(event) => {
            setUnit(event.target.value);
            resetPage();
          }}
          className="w-44"
        >
          <option value="">All units</option>
          {units.data?.units.map((item) => (
            <option key={item.id} value={item.code}>
              {item.code} {item.title}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Kind"
          value={kind}
          onChange={(event) => {
            setKind(event.target.value);
            resetPage();
          }}
          className="w-36"
        >
          <option value="">All kinds</option>
          {['IMAGE', 'AUDIO', 'VIDEO', 'PDF'].map((item) => (
            <option key={item} value={item}>
              {humanize(item)}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            resetPage();
          }}
          className="w-36"
        >
          <option value="">Any status</option>
          {['DRAFT', 'REVIEW', 'APPROVED', 'ARCHIVED'].map((item) => (
            <option key={item} value={item}>
              {humanize(item)}
            </option>
          ))}
        </Select>
        {selected.length && canEdit ? (
          <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-1.5 ring-1 ring-cream-200">
            <span className="text-sm font-semibold">{selected.length} selected</span>
            <Button
              size="sm"
              variant="secondary"
              busy={bulk.isPending && bulk.variables === 'REVIEW'}
              onClick={() => bulk.mutate('REVIEW', { onSuccess: () => setSelected([]) })}
            >
              Send for review
            </Button>
            {canReview ? (
              <Button
                size="sm"
                busy={bulk.isPending && bulk.variables === 'APPROVED'}
                onClick={() =>
                  window.confirm(`Approve ${selected.length} files? Approved files become public.`) &&
                  bulk.mutate('APPROVED', { onSuccess: () => setSelected([]) })
                }
              >
                Approve
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
              Clear
            </Button>
          </div>
        ) : null}
      </div>
      {bulk.data ? (
        <p role="status" className="mb-3 text-sm text-leaf-700">
          {bulk.data.updated} files updated
          {bulk.data.skipped ? `, ${bulk.data.skipped} skipped (not allowed from their current status)` : ''}.
        </p>
      ) : null}
      <FormError error={bulk.error} />

      <div className={`grid grid-cols-1 gap-6 ${openId ? 'xl:grid-cols-[1fr_24rem]' : ''}`}>
        <div>
          {query.isPending ? <Spinner label="Loading files" /> : null}
          {query.error ? <ErrorNotice error={query.error} /> : null}
          {query.data && query.data.assets.length === 0 ? <EmptyState title="No files found" /> : null}
          {query.data ? (
            <>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                {query.data.assets.map((asset) => (
                  <li
                    key={asset.id}
                    className={`flex flex-col gap-2 rounded-xl bg-white p-2 ring-1 ${openId === asset.id ? 'ring-2 ring-leaf-600' : 'ring-cream-200'}`}
                  >
                    <AssetPreview asset={asset} />
                    <button
                      type="button"
                      onClick={() => open(asset.id)}
                      className="truncate text-left text-xs font-semibold hover:underline"
                      title={asset.fileName}
                    >
                      {asset.fileName}
                    </button>
                    <p className="truncate text-xs text-bark-500">
                      v{asset.version} · {formatBytes(asset.sizeBytes)}
                      {asset.materialAssets.length
                        ? ` · ${[...new Set(asset.materialAssets.map((link) => `${link.material.unit.code} ${link.material.code}`))].slice(0, 2).join(', ')}`
                        : ''}
                    </p>
                    <div className="mt-auto flex items-center justify-between">
                      <StatusBadge status={asset.status} />
                      {canEdit ? (
                        <label className="flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={selected.includes(asset.id)}
                            onChange={() => toggle(asset.id)}
                            aria-label={`Select ${asset.fileName}`}
                          />
                          Select
                        </label>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex items-center gap-3 text-sm">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={page === 0}
                  onClick={() => setPage((current) => current - 1)}
                >
                  ← Previous
                </Button>
                <span className="text-bark-500">
                  {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, query.data.total)} of{' '}
                  {query.data.total}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={(page + 1) * PAGE_SIZE >= query.data.total}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next →
                </Button>
              </div>
            </>
          ) : null}
        </div>
        {openId ? <AssetDetailPanel id={openId} onClose={() => open(null)} onOpen={open} /> : null}
      </div>
    </div>
  );
}
