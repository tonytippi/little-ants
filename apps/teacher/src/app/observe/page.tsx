'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo } from 'react';
import type { UnitReleasePayload } from '@little-ants/shared';
import { EmptyState, ErrorNotice, Spinner } from '@little-ants/ui/feedback';
import { ApiError } from '@little-ants/ui/lib/api-client';
import { AppShell } from '../../components/app-shell';
import { ReleaseGate } from '../../components/release-gate';
import { LEVEL_LABELS } from '../../lib/format';
import { useOutboxState } from '../../lib/hooks';
import { links } from '../../lib/links';
import { allOutboxItems, queueObservation } from '../../lib/outbox';
import { useServerObservations, useTeachClasses } from '../../lib/queries';
import { RequireStaff } from '../../lib/session';
import { mergeObservations, nextLevel, observationKey } from '../../lib/sync-policy';
import type { ObservationLevel, TeachClass } from '../../lib/types';

const LEVEL_STYLE: Record<ObservationLevel, string> = {
  NOT_YET: 'bg-ant-50 text-ant-700 ring-ant-100',
  WITH_HELP: 'bg-sun-100 text-bark-900 ring-sun-400/50',
  ON_MY_OWN: 'bg-leaf-600 text-white ring-leaf-600',
};

function Grid({
  payload,
  klass,
  lesson,
}: {
  payload: UnitReleasePayload;
  klass: TeachClass;
  lesson: number | null;
}) {
  const client = useQueryClient();
  const server = useServerObservations(klass.id, payload.unit.code);
  const pending = useQuery({ queryKey: ['outbox-items'], queryFn: allOutboxItems, staleTime: 0 });
  // When queued taps reach the server, reload both lists so the grid stays correct.
  const outbox = useOutboxState();
  useEffect(() => {
    void client.invalidateQueries({ queryKey: ['outbox-items'] });
    void client.invalidateQueries({ queryKey: ['observations', klass.id, payload.unit.code] });
  }, [outbox.pending, client, klass.id, payload.unit.code]);
  const merged = useMemo(
    () => mergeObservations(server.data?.data ?? [], pending.data ?? [], klass.id, payload.unit.code),
    [server.data, pending.data, klass.id, payload.unit.code],
  );

  async function tap(studentId: string, goalOrder: number): Promise<void> {
    const current = merged.get(observationKey(studentId, goalOrder))?.level;
    await queueObservation({
      studentId,
      classId: klass.id,
      unitCode: payload.unit.code,
      goalOrder,
      level: nextLevel(current),
      lessonNumber: lesson,
      observedAt: new Date().toISOString(),
    });
    await client.invalidateQueries({ queryKey: ['outbox-items'] });
  }

  const serverUnavailable = server.error && !(server.error instanceof ApiError);
  if (server.error && !serverUnavailable) return <ErrorNotice error={server.error} />;
  if (klass.students.length === 0)
    return (
      <EmptyState title="No children in this class yet">
        An admin adds children in Little Ants Admin.
      </EmptyState>
    );

  return (
    <>
      {serverUnavailable ? (
        <p className="mb-3 rounded-xl bg-sun-100 px-4 py-2 text-sm text-bark-900">
          Offline: earlier results from the server are not on this device. Your taps are saved and will sync
          later.
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-cream-200 bg-white">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-cream-100">
              <th scope="col" className="sticky left-0 z-10 bg-cream-100 px-3 py-3 text-left font-bold">
                Child
              </th>
              {payload.canDoGoals.map((goal) => (
                <th
                  key={goal.order}
                  scope="col"
                  className="min-w-40 px-2 py-3 text-left align-bottom font-semibold text-bark-700"
                >
                  <span className="text-xs font-bold text-ant-600">Goal {goal.order}</span>
                  <span className="block text-xs leading-snug">{goal.text}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {klass.students.map((student) => (
              <tr key={student.id} className="border-t border-cream-200">
                <th scope="row" className="sticky left-0 z-10 bg-white px-3 py-2 text-left font-semibold">
                  {student.displayName}
                </th>
                {payload.canDoGoals.map((goal) => {
                  const result = merged.get(observationKey(student.id, goal.order));
                  return (
                    <td key={goal.order} className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => void tap(student.id, goal.order)}
                        className={`flex h-12 w-full items-center justify-center rounded-xl px-2 text-xs font-bold ring-1 ring-inset ${
                          result
                            ? LEVEL_STYLE[result.level]
                            : 'bg-white text-bark-500 ring-cream-200 hover:bg-cream-100'
                        }`}
                        aria-label={`${student.displayName}, goal ${goal.order}: ${result ? LEVEL_LABELS[result.level] : 'not observed'}. Tap to change.`}
                      >
                        {result ? LEVEL_LABELS[result.level] : '—'}
                        {result?.pending ? (
                          <span className="ml-1 opacity-70" title="Not synced yet">
                            •
                          </span>
                        ) : null}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Observe() {
  const params = useSearchParams();
  const classId = params.get('class');
  const unit = params.get('unit')?.toUpperCase() ?? null;
  const lesson = params.get('lesson') ? Number(params.get('lesson')) : null;
  const classes = useTeachClasses();
  const klass = classes.data?.data.find((item) => item.id === classId);

  return (
    <AppShell back={{ href: unit ? links.unit(unit, classId) : '/', label: unit ?? 'Today' }}>
      {classes.isPending ? <Spinner /> : null}
      {classes.data && !klass ? (
        <ErrorNotice error={new Error('This class was not found in your classes.')} />
      ) : null}
      {klass ? (
        <ReleaseGate unit={unit}>
          {(payload) => (
            <>
              <div className="mb-5">
                <p className="text-sm font-bold uppercase tracking-wide text-ant-600">
                  {payload.unit.code} · {klass.name}
                  {lesson ? ` · Lesson ${lesson}` : ''}
                </p>
                <h1 className="text-3xl font-extrabold text-bark-900">Show &amp; Share</h1>
                <p className="mt-1 text-sm text-bark-500">
                  Tap a box to change it: Not yet → With help → On my own. Watch 5–6 children each lesson.
                  Saved on this device first, then synced.
                </p>
              </div>
              <Grid payload={payload} klass={klass} lesson={lesson} />
            </>
          )}
        </ReleaseGate>
      ) : null}
    </AppShell>
  );
}

export default function ObservePage() {
  return (
    <Suspense fallback={<Spinner />}>
      <RequireStaff appName="Teacher">
        <Observe />
      </RequireStaff>
    </Suspense>
  );
}
