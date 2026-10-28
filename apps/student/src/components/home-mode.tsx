'use client';

import { useMemo, useState } from 'react';
import type { ListeningItem } from '@little-ants/shared';
import { ErrorNotice, Spinner } from '@little-ants/ui/feedback';
import { useLocalLogs, useRemembered, useSummary, useToday, useUnit } from '../lib/hooks';
import type { PayloadSource } from '../lib/media-cache';
import { queueLog } from '../lib/outbox';
import {
  canStartLeaf,
  localDay,
  localListeningDays,
  mergeHeard,
  mergeProgress,
  recentWeeks,
} from '../lib/progress';
import type { ParentChild, ParentMe } from '../lib/types';
import { Notice, Vi } from './bits';
import { DownloadButton } from './download-button';
import { LibraryView } from './library-view';
import { MyListeningView } from './my-listening-view';
import { PathView } from './path-view';
import { ChildPicker, UnitSwitcher, orderUnits } from './pickers';
import { Player } from './player/player';
import { TabBar, useTab } from './tab-bar';

export const CHILD_KEY = 'la-student-child';

type Playing = { leaf: number; items: ListeningItem[] } | { leaf: null; items: ListeningItem[] };

const MESSAGES = {
  'daily-limit': (
    <>
      Great listening today! The app opens at most 2 new leaves a day. Play an old leaf today; the next leaf
      opens tomorrow.
      <Vi>Mỗi ngày tối đa 2 lá mới. Hôm nay hãy nghe lại lá cũ; ngày mai lá mới sẽ mở.</Vi>
    </>
  ),
  locked: (
    <>
      Leaves open one after another. Play the yellow leaf first.
      <Vi>Các lá mở lần lượt. Hãy nghe chiếc lá vàng trước.</Vi>
    </>
  ),
};

/** At home: choose the child, then their unit's Path, Library and My listening. */
export function HomeMode({ me }: { me: ParentMe }) {
  const [childId, setChildId] = useRemembered<string>(CHILD_KEY);
  const child =
    me.children.find((entry) => entry.id === childId) ?? (me.children.length === 1 ? me.children[0] : null);

  if (me.children.length === 0)
    return (
      <Notice className="mt-6">
        None of your children is in a class at the moment. Ask the school if this is not right.
        <Vi>Hiện chưa có bé nào trong lớp. Vui lòng liên hệ nhà trường nếu chưa đúng.</Vi>
      </Notice>
    );
  if (!child) return <ChildPicker items={me.children} onPick={setChildId} />;
  if (child.units.length === 0)
    return (
      <Notice className="mt-6">
        {child.displayName}&apos;s first unit is not ready yet. Please check again after the first lesson.
        <Vi>Bài học đầu tiên của bé chưa sẵn sàng. Vui lòng xem lại sau buổi học đầu tiên.</Vi>
      </Notice>
    );
  return <ChildListening key={child.id} child={child} />;
}

function ChildListening({ child }: { child: ParentChild }) {
  const units = orderUnits(child.units);
  const [pickedUnit, setUnit] = useRemembered<string>(`la-student-unit:${child.id}`);
  const code = units.find((unit) => unit.code === pickedUnit)?.code ?? units[0]!.code;
  const source = useMemo<PayloadSource>(
    () => ({ kind: 'child', studentId: child.id, code }),
    [child.id, code],
  );
  const unit = useUnit(source);
  const summary = useSummary(child.id, code);
  const logs = useLocalLogs();
  const today = useToday();
  const [tab, setTab] = useTab('home');
  const [playing, setPlaying] = useState<Playing | null>(null);
  const [message, setMessage] = useState<keyof typeof MESSAGES | null>(null);

  const allLogs = useMemo(() => logs.data ?? [], [logs.data]);
  const progress = useMemo(
    () => mergeProgress(summary.data, allLogs, child.id, code, today),
    [summary.data, allLogs, child.id, code, today],
  );
  const localDays = useMemo(() => localListeningDays(allLogs, child.id), [allLogs, child.id]);
  const weeks = useMemo(
    () => recentWeeks(summary.data?.weeks, localDays, today),
    [summary.data, localDays, today],
  );
  const heard = useMemo(
    () => mergeHeard(summary.data?.heard, allLogs, child.id, code),
    [summary.data, allLogs, child.id, code],
  );

  if (unit.isPending) return <Spinner label="Opening the unit" />;
  if (unit.error)
    return (
      <div className="mt-6 flex flex-col gap-3">
        <ErrorNotice error={unit.error} />
        <UnitSwitcher units={child.units} selected={code} onPick={setUnit} />
      </div>
    );
  const payload = unit.data.payload;
  const start = canStartLeaf(progress.nextLeaf, progress, 'home');
  const blocked =
    !start.ok && start.reason === 'daily-limit' ? <Notice>{MESSAGES['daily-limit']}</Notice> : null;

  const playLeaf = (number: number): void => {
    const check = canStartLeaf(number, progress, 'home');
    const leaf = payload.leaves.find((entry) => entry.number === number);
    if (!check.ok || !leaf) {
      setMessage(check.ok ? null : check.reason);
      return;
    }
    setMessage(null);
    setPlaying({ leaf: number, items: leaf.items });
  };

  const finished = (itemsHeard: string[]): void => {
    if (!playing || playing.leaf === null) return;
    void queueLog({
      studentId: child.id,
      unitCode: payload.unit.code,
      leaf: playing.leaf,
      playedOn: localDay(),
      completedAt: new Date().toISOString(),
      itemsHeard,
      isNew: !progress.completed.has(playing.leaf),
    });
  };

  return (
    <>
      {playing ? (
        <Player
          payload={payload}
          items={playing.items}
          leaf={playing.leaf}
          mode="home"
          onExit={() => setPlaying(null)}
          onFinished={finished}
        />
      ) : tab === 'library' ? (
        <LibraryView
          payload={payload}
          finished={progress.completed}
          heard={heard}
          onPlay={(item) => setPlaying({ leaf: null, items: [item] })}
        />
      ) : tab === 'me' ? (
        <MyListeningView
          childName={child.displayName}
          payload={payload}
          greenLeaves={progress.completed.size}
          weeks={weeks}
          localDays={localDays}
          heard={heard}
          today={today}
        />
      ) : (
        <>
          {unit.data.offline ? (
            <Notice className="mb-3">
              No internet: showing the copy saved on this device.
              <Vi>Không có mạng: đang dùng bản đã lưu trên máy.</Vi>
            </Notice>
          ) : null}
          {message && !(blocked && message === 'daily-limit') ? (
            <Notice tone="warn" className="mb-3">
              {MESSAGES[message]}
            </Notice>
          ) : null}
          <PathView
            payload={payload}
            progress={progress}
            mode="home"
            startLeaf={progress.nextLeaf}
            daysThisWeek={weeks[0]?.days ?? 0}
            blocked={blocked}
            onPlay={playLeaf}
            tools={
              <>
                <UnitSwitcher units={child.units} selected={code} onPick={setUnit} />
                <DownloadButton source={source} unit={unit.data} />
              </>
            }
          />
        </>
      )}
      <TabBar
        mode="home"
        tab={tab}
        onSelect={(next) => {
          setPlaying(null);
          setTab(next);
        }}
      />
    </>
  );
}
