'use client';

import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Suspense } from 'react';
import type { ReleaseLesson, UnitReleasePayload } from '@little-ants/shared';
import { Badge } from '@little-ants/ui/badge';
import { buttonClass } from '@little-ants/ui/button';
import { Card, Spinner } from '@little-ants/ui/feedback';
import { AppShell } from '../../components/app-shell';
import { AudioBar } from '../../components/player/audio-bar';
import { audioFor } from '../../components/player/stage-content';
import { ReleaseGate } from '../../components/release-gate';
import { stageLabel } from '../../lib/format';
import { kvGet, kvSet } from '../../lib/local-db';
import { links } from '../../lib/links';
import { useLessonParams } from '../../lib/search';
import { RequireStaff } from '../../lib/session';

/** Ticks on the prep list are kept on this device only. */
function usePrepTicks(key: string) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['prep', key],
    queryFn: async () => (await kvGet<number[]>(`prep:${key}`)) ?? [],
  });
  const toggle = async (index: number): Promise<void> => {
    // A load still in flight must not overwrite the tick the teacher just made.
    void client.cancelQueries({ queryKey: ['prep', key] });
    const current = new Set(client.getQueryData<number[]>(['prep', key]) ?? []);
    if (current.has(index)) current.delete(index);
    else current.add(index);
    const next = [...current].sort((a, b) => a - b);
    client.setQueryData(['prep', key], next); // show the tick at once
    await kvSet(`prep:${key}`, next);
  };
  return { ticked: new Set(query.data ?? []), loading: query.isPending, toggle };
}

function Prepare({
  payload,
  lesson,
  classId,
}: {
  payload: UnitReleasePayload;
  lesson: ReleaseLesson;
  classId: string | null;
}) {
  const key = `${payload.unit.code}:${lesson.number}:${classId ?? '-'}`;
  const { ticked, loading, toggle } = usePrepTicks(key);
  const newMaterials = payload.materials.filter((material) => lesson.newToday.includes(material.code));
  const ref = { unit: payload.unit.code, lesson: lesson.number, classId };
  const done = lesson.prep.filter((_, index) => ticked.has(index)).length;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-ant-600">
            {payload.unit.code} · Week {lesson.week} · {stageLabel(lesson.stage)}
          </p>
          <h1 className="text-3xl font-extrabold text-bark-900">Prepare lesson {lesson.number}</h1>
          <p className="mt-1 text-bark-700">
            {lesson.minutes} min lesson
            {lesson.prepMinutes ? ` · about ${lesson.prepMinutes} min to prepare` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={links.print(ref)} className={buttonClass('secondary', 'lg')}>
            Print
          </Link>
          <Link href={links.teach(ref)} className={buttonClass('primary', 'lg')}>
            ▶ Teach
          </Link>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-extrabold">Prepare</h2>
            <span className="text-sm font-semibold text-bark-500">
              {done} / {lesson.prep.length} ready
            </span>
          </div>
          <ul className="mt-3 flex flex-col gap-1">
            {lesson.prep.map((item, index) => {
              const isNew = item.materialCode !== null && lesson.newToday.includes(item.materialCode);
              return (
                <li key={index}>
                  <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-cream-100">
                    <input
                      type="checkbox"
                      className="size-6 accent-leaf-600"
                      checked={ticked.has(index)}
                      disabled={loading}
                      onChange={() => void toggle(index)}
                    />
                    <span className={ticked.has(index) ? 'text-bark-500 line-through' : 'text-bark-900'}>
                      {item.text}
                    </span>
                    {isNew ? <Badge tone="ant">NEW</Badge> : null}
                  </label>
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="flex flex-col gap-5">
          <Card>
            <h2 className="text-lg font-extrabold">By the end, children can…</h2>
            <ul className="mt-2 list-disc pl-5 text-bark-900">
              {lesson.goals.map((goal) => (
                <li key={goal}>{goal}</li>
              ))}
            </ul>
            <h3 className="mt-4 text-xs font-bold uppercase tracking-wide text-bark-500">Key language</h3>
            <p className="mt-1 whitespace-pre-line font-child text-lg">{lesson.keyLanguage}</p>
          </Card>

          <Card>
            <h2 className="text-lg font-extrabold">Practise the NEW items</h2>
            {newMaterials.length === 0 ? (
              <p className="mt-2 text-sm text-bark-500">Nothing new today — just review.</p>
            ) : null}
            <div className="mt-3 flex flex-col gap-4">
              {newMaterials.map((material) => {
                const tracks = audioFor(material, 0);
                return (
                  <section key={material.code} className="rounded-xl bg-cream-100 p-3">
                    <p className="font-bold">
                      <span className="mr-2 text-xs text-ant-600">{material.code}</span>
                      {material.title}
                    </p>
                    {material.format ? <p className="text-sm text-bark-500">{material.format}</p> : null}
                    {tracks.length ? (
                      <div className="mt-2">
                        <AudioBar tracks={tracks} compact />
                      </div>
                    ) : (
                      <p className="mt-1 text-xs text-bark-500">No recording yet.</p>
                    )}
                    {material.fullText ? (
                      <p className="mt-2 whitespace-pre-line font-child text-base">{material.fullText}</p>
                    ) : null}
                    {material.actions ? (
                      <p className="mt-2 text-sm text-bark-700">Actions: {material.actions}</p>
                    ) : null}
                  </section>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function PrepareScreen() {
  const { unit, lesson, classId } = useLessonParams();
  return (
    <AppShell back={{ href: unit ? links.unit(unit, classId) : '/', label: unit ?? 'Today' }}>
      <ReleaseGate unit={unit}>
        {(payload) => {
          const found = payload.lessons.find((item) => item.number === lesson);
          return found ? (
            <Prepare payload={payload} lesson={found} classId={classId} />
          ) : (
            <p>Lesson {lesson} was not found.</p>
          );
        }}
      </ReleaseGate>
    </AppShell>
  );
}

export default function PreparePage() {
  return (
    <Suspense fallback={<Spinner />}>
      <RequireStaff appName="Teacher">
        <PrepareScreen />
      </RequireStaff>
    </Suspense>
  );
}
