'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { PRODUCTION_STAGES, PRODUCTION_STATES } from '@little-ants/shared';
import { Button } from '@little-ants/ui/button';
import { EmptyState, ErrorNotice, Spinner } from '@little-ants/ui/feedback';
import { Select, TextInput } from '@little-ants/ui/field';
import { api } from '../../lib/api';
import { humanize, useApiMutation, usePermissions } from '../../lib/hooks';
import type { ProductionRow } from '../../lib/types';
import { FormError } from '../form-error';

interface ProductionMaterial {
  id: string;
  code: string;
  title: string;
  type: string;
  production: ProductionRow[];
}

const STATE_STYLE: Record<string, string> = {
  NOT_STARTED: 'bg-white',
  IN_PROGRESS: 'bg-sun-100',
  REVIEW: 'bg-ant-50',
  DONE: 'bg-leaf-50',
  NOT_APPLICABLE: 'bg-cream-100 text-bark-500',
};

const STAGE_LABEL: Record<string, string> = {
  TEXT: 'Text',
  ENGLISH_CHECK: 'English check',
  ILLUSTRATION: 'Illustration',
  LAYOUT: 'Layout',
  AUDIO_VIDEO: 'Audio / video',
  TEACHER_TEST: 'Teacher test',
  PRINT_READY: 'Print-ready',
};

/** Material × production stage board (replaces Master Sheet tab 9). */
export function ProductionTab({ code }: { code: string }) {
  const key = ['production', code];
  const query = useQuery({
    queryKey: key,
    queryFn: () => api.get<ProductionMaterial[]>(`/content/units/${code}/production`),
  });
  if (query.isPending) return <Spinner label="Loading production" />;
  if (query.error) return <ErrorNotice error={query.error} />;
  const rows = query.data.filter((material) => material.production.length > 0);
  if (rows.length === 0) return <EmptyState title="No production rows yet" />;
  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-cream-200 bg-white">
      <table className="w-full min-w-[64rem] text-sm">
        <thead className="bg-cream-100 text-left text-xs uppercase tracking-wide text-bark-500">
          <tr>
            <th className="px-3 py-2">Deliverable</th>
            {PRODUCTION_STAGES.map((stage) => (
              <th key={stage} className="px-2 py-2">
                {STAGE_LABEL[stage]}
              </th>
            ))}
            <th className="px-3 py-2">Owner · due</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((material) => (
            <ProductionLine key={material.id} material={material} invalidateKey={key} unitCode={code} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProductionLine({
  material,
  invalidateKey,
  unitCode,
}: {
  material: ProductionMaterial;
  invalidateKey: string[];
  unitCode: string;
}) {
  const { canEdit } = usePermissions();
  const invalidate = [invalidateKey, ['unit', unitCode], ['units']];
  const update = useApiMutation(
    ({ id, data }: { id: string; data: Partial<ProductionRow> }) =>
      api.patch(`/content/production/${id}`, data),
    invalidate,
  );
  const first = material.production[0];
  const [editing, setEditing] = useState(false);
  const [owner, setOwner] = useState(first?.owner ?? '');
  const [due, setDue] = useState(first?.dueDate?.slice(0, 10) ?? '');

  async function saveOwner(): Promise<void> {
    for (const row of material.production) {
      await update.mutateAsync({
        id: row.id,
        data: { owner, dueDate: due ? new Date(due).toISOString() : null },
      });
    }
    setEditing(false);
  }

  return (
    <tr className="border-t border-cream-200">
      <th scope="row" className="px-3 py-2 text-left font-normal">
        <span className="font-bold text-ant-500">{material.code}</span>{' '}
        <span className="font-semibold">{material.title}</span>
      </th>
      {PRODUCTION_STAGES.map((stage) => {
        const row = material.production.find((item) => item.stage === stage);
        if (!row)
          return (
            <td key={stage} className="px-2 py-2 text-bark-500">
              —
            </td>
          );
        return (
          <td key={stage} className="px-1 py-1">
            <Select
              aria-label={`${material.code} ${STAGE_LABEL[stage]}`}
              value={row.state}
              disabled={!canEdit}
              className={`h-9 px-2 text-xs ${STATE_STYLE[row.state] ?? ''}`}
              onChange={(event) => update.mutate({ id: row.id, data: { state: event.target.value } })}
            >
              {PRODUCTION_STATES.map((state) => (
                <option key={state} value={state}>
                  {state === 'NOT_APPLICABLE' ? 'N/A' : humanize(state)}
                </option>
              ))}
            </Select>
          </td>
        );
      })}
      <td className="px-3 py-2 text-xs">
        {editing ? (
          <div className="flex flex-col gap-1">
            <TextInput
              aria-label="Owner"
              placeholder="Owner"
              value={owner}
              onChange={(event) => setOwner(event.target.value)}
            />
            <TextInput
              aria-label="Due date"
              type="date"
              value={due}
              onChange={(event) => setDue(event.target.value)}
            />
            <div className="flex gap-1">
              <Button size="sm" busy={update.isPending} onClick={() => void saveOwner()}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => setEditing(true)}
            className="text-left hover:underline disabled:no-underline"
          >
            {first?.owner || 'No owner'} · {first?.dueDate ? first.dueDate.slice(0, 10) : 'no date'}
          </button>
        )}
        {update.error ? <FormError error={update.error} /> : null}
      </td>
    </tr>
  );
}
