'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@little-ants/ui/button';
import { Card, EmptyState, ErrorNotice, Spinner } from '@little-ants/ui/feedback';
import { Field, TextInput } from '@little-ants/ui/field';
import { api } from '../../lib/api';
import { formatDate, useApiMutation, usePermissions } from '../../lib/hooks';
import type { ReleaseCheck, UnitDetail } from '../../lib/types';
import { FormError } from '../form-error';

/** Publish the unit for teachers and see earlier versions. */
export function ReleasesTab({ unit }: { unit: UnitDetail }) {
  const { canReview } = usePermissions();
  const [note, setNote] = useState('');
  const checkKey = ['release-check', unit.code];
  const check = useQuery({
    queryKey: checkKey,
    queryFn: () => api.get<ReleaseCheck>(`/content/units/${unit.code}/release-check`),
  });
  const publish = useApiMutation(
    () => api.post<{ version: number }>(`/content/units/${unit.code}/releases`, { note }),
    [checkKey, ['unit', unit.code], ['units']],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <Card>
        <h2 className="mb-3 font-bold">Ready to publish?</h2>
        {check.isPending ? <Spinner label="Checking" /> : null}
        {check.error ? <ErrorNotice error={check.error} /> : null}
        {check.data ? (
          <div className="flex flex-col gap-4">
            {check.data.blockers.length === 0 ? (
              <p className="rounded-lg bg-leaf-50 px-3 py-2 text-sm font-semibold text-leaf-700">
                Everything is approved. The unit can be published.
              </p>
            ) : (
              <div>
                <p className="text-sm font-semibold text-ant-700">Fix these first:</p>
                <ul className="mt-1 list-disc pl-5 text-sm">
                  {check.data.blockers.map((blocker) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                </ul>
              </div>
            )}
            {check.data.warnings.length ? (
              <div>
                <p className="text-sm font-semibold text-bark-700">Good to know:</p>
                <ul className="mt-1 list-disc pl-5 text-sm text-bark-500">
                  {check.data.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {canReview ? (
              <form
                className="flex flex-col gap-3 border-t border-cream-200 pt-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (
                    window.confirm(
                      `Publish ${unit.code} for teachers? Teachers get the new version next time they open the unit.`,
                    )
                  ) {
                    publish.mutate(undefined, { onSuccess: () => setNote('') });
                  }
                }}
              >
                <Field label="Release note" hint="What changed, for teachers and the team.">
                  {(id, describedBy) => (
                    <TextInput
                      id={id}
                      aria-describedby={describedBy}
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      maxLength={500}
                    />
                  )}
                </Field>
                <Button
                  type="submit"
                  className="self-start"
                  busy={publish.isPending}
                  disabled={check.data.blockers.length > 0}
                >
                  Publish new version
                </Button>
                {publish.data ? (
                  <p role="status" className="text-sm font-semibold text-leaf-700">
                    Published version {publish.data.version}.
                  </p>
                ) : null}
                <FormError error={publish.error} />
              </form>
            ) : (
              <p className="text-sm text-bark-500">Only reviewers can publish.</p>
            )}
          </div>
        ) : null}
      </Card>

      <Card>
        <h2 className="mb-3 font-bold">Published versions</h2>
        {unit.releases.length === 0 ? (
          <EmptyState title="Not published yet" />
        ) : (
          <ol className="flex flex-col divide-y divide-cream-200">
            {unit.releases.map((release) => (
              <li key={release.id} className="py-2 text-sm">
                <span className="font-bold">v{release.version}</span> ·{' '}
                {formatDate(release.publishedAt, true)} · {release.publishedBy?.name ?? '—'}
                {release.note ? <p className="text-bark-500">{release.note}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
