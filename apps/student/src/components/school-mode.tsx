'use client';

import { useMemo, useState } from 'react';
import { LISTENING_LEAF_COUNT, type ListeningItem } from '@little-ants/shared';
import { ErrorNotice, Spinner } from '@little-ants/ui/feedback';
import { useClassRuns, useRemembered, useSchoolClasses, useUnit } from '../lib/hooks';
import type { PayloadSource } from '../lib/media-cache';
import { queueClassRun } from '../lib/outbox';
import { classProgress } from '../lib/progress';
import type { SchoolClass, StaffMe } from '../lib/types';
import { Notice } from './bits';
import { DownloadButton } from './download-button';
import { LibraryView } from './library-view';
import { PathView } from './path-view';
import { ClassPicker } from './pickers';
import { Player } from './player/player';
import { TabBar, useTab } from './tab-bar';
import { TeacherView } from './teacher-view';

const CLASS_KEY = 'la-student-class';

/** At school (staff only): pick the class, then play the lesson's leaf on the big screen. */
export function SchoolMode({ staff }: { staff: StaffMe }) {
  const classes = useSchoolClasses(true);
  const [classId, setClassId] = useRemembered<string>(CLASS_KEY);

  if (classes.isPending) return <Spinner label="Loading your classes" />;
  if (classes.error) return <ErrorNotice error={classes.error} />;
  const list = classes.data;
  const chosen = list.find((entry) => entry.id === classId) ?? (list.length === 1 ? list[0] : null);
  if (list.length === 0) return <Notice className="mt-6">You have no classes yet.</Notice>;
  if (!chosen) return <ClassPicker items={list} onPick={setClassId} />;
  return (
    <ClassListening
      key={chosen.id}
      staff={staff}
      schoolClass={chosen}
      onChangeClass={list.length > 1 ? () => setClassId(null) : undefined}
    />
  );
}

function ClassListening({
  staff,
  schoolClass,
  onChangeClass,
}: {
  staff: StaffMe;
  schoolClass: SchoolClass;
  onChangeClass?: () => void;
}) {
  const code = schoolClass.currentUnit?.code ?? null;
  const source = useMemo<PayloadSource | null>(() => (code ? { kind: 'school', code } : null), [code]);
  const unit = useUnit(source);
  const runs = useClassRuns();
  const [tab, setTab] = useTab('school');
  const [storedLesson, setLesson] = useRemembered<string>(`la-student-lesson:${schoolClass.id}`);
  const [playing, setPlaying] = useState<{ leaf: number | null; items: ListeningItem[] } | null>(null);
  const lesson = clampLesson(Number(storedLesson ?? schoolClass.nextLesson));

  const progress = useMemo(
    () => classProgress(runs.data ?? [], schoolClass.id, code ?? ''),
    [runs.data, schoolClass.id, code],
  );

  if (!code)
    return (
      <Notice className="mt-6">
        {schoolClass.name} has no unit yet. {onChangeClass ? <ChangeClass onClick={onChangeClass} /> : null}
      </Notice>
    );
  if (unit.isPending) return <Spinner label="Opening the unit" />;
  if (unit.error) return <ErrorNotice error={unit.error} />;
  const payload = unit.data.payload;

  const playLeaf = (number: number): void => {
    const leaf = payload.leaves.find((entry) => entry.number === number);
    if (!leaf) return;
    setLesson(String(number));
    setPlaying({ leaf: number, items: leaf.items });
  };

  const finished = (): void => {
    if (!playing || playing.leaf === null) return;
    void queueClassRun({
      classId: schoolClass.id,
      unitCode: payload.unit.code,
      leaf: playing.leaf,
      playedAt: new Date().toISOString(),
      ownerId: staff.user.id,
    });
  };

  return (
    <>
      {playing ? (
        <Player
          payload={payload}
          items={playing.items}
          leaf={playing.leaf}
          mode="school"
          onExit={() => setPlaying(null)}
          onFinished={finished}
        />
      ) : tab === 'library' ? (
        <LibraryView
          payload={payload}
          finished={
            new Set(payload.leaves.filter((leaf) => leaf.number <= lesson).map((leaf) => leaf.number))
          }
          heard={{}}
          onPlay={(item) => setPlaying({ leaf: null, items: [item] })}
        />
      ) : tab === 'teacher' ? (
        <TeacherView
          payload={payload}
          lesson={lesson}
          onLesson={(value) => setLesson(String(value))}
          onPlay={playLeaf}
        />
      ) : (
        <PathView
          payload={payload}
          progress={progress}
          mode="school"
          startLeaf={lesson}
          daysThisWeek={0}
          blocked={null}
          onPlay={playLeaf}
          tools={
            <>
              <span className="rounded-full bg-cream-100 px-3.5 py-2 text-sm font-semibold">
                {schoolClass.name} · {schoolClass.campus.name}
              </span>
              {onChangeClass ? <ChangeClass onClick={onChangeClass} /> : null}
              <DownloadButton source={source!} unit={unit.data} />
            </>
          }
        />
      )}
      <TabBar
        mode="school"
        tab={tab}
        onSelect={(next) => {
          setPlaying(null);
          setTab(next);
        }}
      />
    </>
  );
}

function ChangeClass({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-10 rounded-full px-3 text-sm font-semibold text-leaf-700 underline"
    >
      Change class
    </button>
  );
}

function clampLesson(value: number): number {
  return Number.isFinite(value) ? Math.min(Math.max(Math.round(value), 1), LISTENING_LEAF_COUNT) : 1;
}
