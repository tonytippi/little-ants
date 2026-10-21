'use client';

import { useState } from 'react';
import { EmptyState } from '@little-ants/ui/feedback';
import { TextInput } from '@little-ants/ui/field';
import { api } from '../../lib/api';
import { formatDate, useApiMutation, usePermissions } from '../../lib/hooks';
import type { UnitDetail } from '../../lib/types';
import { FormError } from '../form-error';

type Gate = UnitDetail['gateChecks'][number];

/** Gate checklist (Master Sheet tab 10). */
export function GatesTab({ unit }: { unit: UnitDetail }) {
  const gates = [...new Set(unit.gateChecks.map((check) => check.gate))];
  if (gates.length === 0) return <EmptyState title="No gate checks" />;
  return (
    <div className="flex flex-col gap-4">
      {gates.map((gate) => {
        const checks = unit.gateChecks.filter((check) => check.gate === gate);
        const done = checks.filter((check) => check.done).length;
        return (
          <section key={gate} aria-labelledby={`gate-${gate}`} className="rounded-xl bg-white p-4 ring-1 ring-cream-200">
            <h2 id={`gate-${gate}`} className="mb-3 font-bold">
              Gate {gate}{' '}
              <span className="text-sm font-normal text-bark-500">
                · {done}/{checks.length} done · signs: {checks[0]?.signer || '—'}
              </span>
            </h2>
            <ul className="flex flex-col gap-2">
              {checks.map((check) => (
                <GateItem key={check.id} check={check} unitCode={unit.code} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function GateItem({ check, unitCode }: { check: Gate; unitCode: string }) {
  const { canEdit } = usePermissions();
  const [notes, setNotes] = useState(check.notes);
  const update = useApiMutation((data: { done?: boolean; notes?: string }) => api.patch(`/content/units/gate-checks/${check.id}`, data), [['unit', unitCode]]);
  return (
    <li className="flex flex-wrap items-start gap-3">
      <label className="flex flex-1 items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1 size-4 accent-leaf-600" checked={check.done} disabled={!canEdit || update.isPending} onChange={(event) => update.mutate({ done: event.target.checked })} />
        <span>
          {check.text}
          {check.done ? <span className="block text-xs text-bark-500">Done {formatDate(check.doneAt)} · {check.signer}</span> : null}
        </span>
      </label>
      <TextInput
        aria-label={`Notes for: ${check.text}`}
        placeholder="Notes"
        value={notes}
        disabled={!canEdit}
        onChange={(event) => setNotes(event.target.value)}
        onBlur={() => notes !== check.notes && update.mutate({ notes })}
        className="w-64"
      />
      {update.error ? <FormError error={update.error} /> : null}
    </li>
  );
}
