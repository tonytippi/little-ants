'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { MATERIAL_TYPES } from '@little-ants/shared';
import { StatusBadge } from '@little-ants/ui/badge';
import { Button } from '@little-ants/ui/button';
import { EmptyState } from '@little-ants/ui/feedback';
import { Select, TextInput } from '@little-ants/ui/field';
import { api } from '../../lib/api';
import { humanize, useApiMutation, usePermissions } from '../../lib/hooks';
import type { MaterialSummary, UnitDetail } from '../../lib/types';
import { FormError } from '../form-error';

export function MaterialsTab({ unit }: { unit: UnitDetail }) {
  const { canEdit } = usePermissions();
  const [showArchived, setShowArchived] = useState(false);
  const materials = unit.materials.filter((material) => showArchived || material.status !== 'ARCHIVED');
  const groups = [...new Set(materials.map((material) => material.type))];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-4">
        {canEdit ? <AddMaterialForm unit={unit} /> : null}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => setShowArchived(event.target.checked)}
          />
          Show archived
        </label>
      </div>
      {materials.length === 0 ? <EmptyState title="No materials" /> : null}
      {groups.map((type) => (
        <section key={type} aria-labelledby={`type-${type}`}>
          <h2 id={`type-${type}`} className="mb-2 text-sm font-bold uppercase tracking-wide text-bark-500">
            {humanize(type)}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {materials
              .filter((material) => material.type === type)
              .map((material) => (
                <li key={material.id}>
                  <MaterialCard material={material} />
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function MaterialCard({ material }: { material: MaterialSummary }) {
  const done = material.production.filter(
    (row) => row.state === 'DONE' || row.state === 'NOT_APPLICABLE',
  ).length;
  return (
    <Link
      href={`/materials/${material.id}`}
      className="flex h-full flex-col gap-2 rounded-xl border border-cream-200 bg-white p-3 hover:border-leaf-500"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-bold text-ant-500">{material.code}</p>
          <p className="truncate font-semibold">{material.title}</p>
        </div>
        <StatusBadge status={material.status} />
      </div>
      {material.targetLanguage ? (
        <p className="line-clamp-2 text-xs text-bark-500">{material.targetLanguage}</p>
      ) : null}
      <p className="mt-auto text-xs text-bark-500">
        {material._count.pages} pages · {material._count.assets} files
        {material.firstLesson ? ` · first in L${material.firstLesson}` : ''}
        {material.production.length ? ` · production ${done}/${material.production.length}` : ''}
      </p>
    </Link>
  );
}

function AddMaterialForm({ unit }: { unit: UnitDetail }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [type, setType] = useState<string>('SONG');
  const [title, setTitle] = useState('');
  const add = useApiMutation(
    () =>
      api.post<{ id: string }>(`/content/units/${unit.code}/materials`, {
        code: code.toUpperCase(),
        type,
        title,
      }),
    [['unit', unit.code]],
  );

  function submit(event: FormEvent): void {
    event.preventDefault();
    add.mutate(undefined, { onSuccess: (material) => router.push(`/materials/${material.id}`) });
  }

  if (!open) {
    return (
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        + Add material
      </Button>
    );
  }
  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap items-end gap-2 rounded-xl bg-white p-3 ring-1 ring-cream-200"
    >
      <TextInput
        aria-label="Code"
        placeholder="Code, e.g. SG4"
        required
        value={code}
        onChange={(event) => setCode(event.target.value)}
        className="w-32"
      />
      <Select
        aria-label="Type"
        value={type}
        onChange={(event) => setType(event.target.value)}
        className="w-44"
      >
        {MATERIAL_TYPES.map((item) => (
          <option key={item} value={item}>
            {humanize(item)}
          </option>
        ))}
      </Select>
      <TextInput
        aria-label="Title"
        placeholder="Title"
        required
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        className="w-64"
      />
      <Button type="submit" busy={add.isPending}>
        Create
      </Button>
      <Button variant="ghost" onClick={() => setOpen(false)}>
        Close
      </Button>
      {add.error ? (
        <div className="w-full">
          <FormError error={add.error} />
        </div>
      ) : null}
    </form>
  );
}
