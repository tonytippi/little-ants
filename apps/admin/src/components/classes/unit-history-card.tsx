'use client';

import { useState } from 'react';
import { Badge } from '@little-ants/ui/badge';
import { Button } from '@little-ants/ui/button';
import { Card, EmptyState, ErrorNotice } from '@little-ants/ui/feedback';
import { Field, Select } from '@little-ants/ui/field';
import { api } from '../../lib/api';
import { formatDay, useApiMutation } from '../../lib/hooks';
import { orgKeys, useLevels } from '../../lib/org';
import type { ClassDetail } from '../../lib/types';
import { ConfirmDialog } from '../confirm-dialog';

/** The units a class worked on, newest first, and "start next unit" while the class is active. */
export function UnitHistoryCard({ klass }: { klass: ClassDetail }) {
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">Units</h2>
        {klass.status === 'ACTIVE' ? <StartNextUnit klass={klass} /> : null}
      </div>
      {klass.unitRuns.length === 0 ? (
        <EmptyState title="No unit started yet" />
      ) : (
        <ol className="divide-y divide-cream-200">
          {klass.unitRuns.map((run) => (
            <li key={run.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span>
                <span className="font-semibold">{run.unit.code}</span> {run.unit.title}{' '}
                {run.endedOn ? null : <Badge tone="leaf">now · lesson {klass.nextLesson}</Badge>}
              </span>
              <span className="text-xs text-bark-500">
                {formatDay(run.startedOn)} – {run.endedOn ? formatDay(run.endedOn) : 'today'}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function StartNextUnit({ klass }: { klass: ClassDetail }) {
  const levels = useLevels();
  const [open, setOpen] = useState(false);
  const [unitId, setUnitId] = useState('');
  const start = useApiMutation(
    (id: string) => api.post(`/classes/${klass.id}/next-unit`, { unitId: id }),
    [orgKeys.class(klass.id), orgKeys.allClasses],
  );
  const units = levels.data?.find((level) => level.id === klass.levelId)?.units ?? [];
  const chosen = units.find((unit) => unit.id === unitId);

  /** The unit after the current one in the level, or the first unit when none has started. */
  function suggestedUnitId(): string {
    const index = units.findIndex((unit) => unit.id === klass.currentUnitId);
    return (index === -1 ? units[0] : units[index + 1])?.id ?? '';
  }

  function close(): void {
    setOpen(false);
    start.reset();
  }

  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        disabled={!levels.data}
        onClick={() => {
          setUnitId(suggestedUnitId());
          setOpen(true);
        }}
      >
        {klass.currentUnit ? 'Start next unit' : 'Start first unit'}
      </Button>
      {levels.error ? <ErrorNotice error={levels.error} /> : null}
      <ConfirmDialog
        open={open}
        title={klass.currentUnit ? 'Start the next unit' : 'Start the first unit'}
        confirmLabel="Start unit"
        busy={start.isPending}
        error={start.error}
        disabled={!unitId}
        onClose={close}
        onConfirm={() => start.mutate(unitId, { onSuccess: close })}
      >
        <Field label="Unit">
          {(id) => (
            <Select id={id} required value={unitId} onChange={(event) => setUnitId(event.target.value)}>
              <option value="" disabled>
                Choose a unit
              </option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id} disabled={unit.id === klass.currentUnitId}>
                  {unit.code} {unit.title}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <p>
          {klass.currentUnit ? `${klass.currentUnit.code} ends today and the` : 'The'} class starts{' '}
          {chosen ? chosen.code : 'the chosen unit'} at <strong>lesson 1</strong>. Teachers see the new unit
          straight away.
        </p>
      </ConfirmDialog>
    </>
  );
}
