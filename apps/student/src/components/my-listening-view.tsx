'use client';

import { useMemo } from 'react';
import {
  DAYS_PER_WEEK_GOAL,
  LISTENING_KIND_COLOURS,
  LISTENING_LEAF_COUNT,
  listeningItemKey,
  listeningItemKind,
  type ListeningPayload,
} from '@little-ants/shared';
import { unitItems } from '../lib/library';
import { weekDates, type WeekCount } from '../lib/progress';
import { GoalLeaves, Vi, shortDate } from './bits';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** My listening: a page made to be photographed and sent to the teacher each week. */
export function MyListeningView({
  childName,
  payload,
  greenLeaves,
  weeks,
  localDays,
  heard,
  today,
}: {
  childName: string;
  payload: ListeningPayload;
  greenLeaves: number;
  /** Newest first; the first is this week. */
  weeks: WeekCount[];
  /** Days with listening recorded on this device. */
  localDays: Set<string>;
  heard: Record<string, number>;
  today: string;
}) {
  const thisWeek = weeks[0] ?? { weekStart: today, days: 0, goal: false };
  const items = useMemo(() => unitItems(payload.leaves), [payload.leaves]);
  const most = Math.max(5, ...items.map((item) => heard[listeningItemKey(item)] ?? 0));
  const totalDays = weeks.reduce((sum, week) => sum + week.days, 0);
  const goalWeeks = weeks.filter((week) => week.goal).length;

  return (
    <div>
      <h1 className="font-display text-[34px] leading-tight font-extrabold text-ant-500">My listening</h1>
      <p className="font-display text-xl font-bold text-leaf-700">
        {childName} · {payload.unit.title} · {shortDate(`${today}T12:00:00`)}
      </p>
      <p className="mt-1 max-w-[62ch] text-bark-500">
        The goal is <b>{DAYS_PER_WEEK_GOAL} days a week</b>, one leaf a day.
        <Vi>Mục tiêu: nghe ít nhất 4 ngày mỗi tuần, mỗi ngày một chiếc lá.</Vi>
      </p>

      <div className="my-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat value={thisWeek.days} label="days this week" vi="ngày trong tuần này" />
        <Stat value={greenLeaves} label={`green leaves (of ${LISTENING_LEAF_COUNT})`} vi="chiếc lá xanh" />
        <Stat value={totalDays} label="days in 8 weeks" vi="ngày trong 8 tuần" />
        <Stat value={goalWeeks} label="weeks with ★" vi="tuần đạt ★" />
      </div>

      <div className="grid gap-7 lg:grid-cols-2">
        <section>
          <h2 className="mt-2 font-display text-2xl font-extrabold">This week</h2>
          <div className="mt-2 grid max-w-md grid-cols-7 gap-2 text-center text-xs font-semibold text-bark-500">
            {weekDates(thisWeek.weekStart).map((day, index) => (
              <div key={day} className="flex flex-col items-center gap-1">
                <span>{WEEKDAYS[index]}</span>
                <i
                  role="img"
                  className={`leaf-dot block aspect-square w-full max-w-10 ${localDays.has(day) ? 'bg-leaf-600' : 'bg-cream-200'} ${day > today ? 'opacity-40' : ''}`}
                  aria-label={`${day}${localDays.has(day) ? ': listened' : ''}`}
                />
              </div>
            ))}
          </div>

          <h2 className="mt-6 font-display text-2xl font-extrabold">My weeks</h2>
          <ol className="mt-2 flex flex-col gap-1.5">
            {weeks.map((week, index) => (
              <li
                key={week.weekStart}
                className="grid grid-cols-[7.5rem_auto_1fr] items-center gap-3 text-sm font-semibold"
              >
                <span className="text-bark-500">
                  {index === 0 ? 'This week' : `Week of ${shortDate(`${week.weekStart}T12:00:00`)}`}
                </span>
                <GoalLeaves days={week.days} size="sm" />
                <span className={week.goal ? 'font-bold text-leaf-700' : 'text-bark-500'}>
                  {week.goal ? `★ ${week.days}` : `${week.days} / ${DAYS_PER_WEEK_GOAL}`}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-4 rounded-2xl bg-cream-100 px-4 py-3 text-sm font-medium text-bark-500">
            Show this page to your teacher each week (a photo in the class group is fine). Every week with 4
            green leaves earns a sticker.
            <Vi>Mỗi tuần gửi cô ảnh trang này. Mỗi tuần đủ 4 lá xanh được một sticker.</Vi>
          </p>
        </section>

        <section>
          <h2 className="mt-2 font-display text-2xl font-extrabold">Times I heard it</h2>
          <div className="mt-2 flex flex-col gap-2">
            {items.map((item) => {
              const count = heard[listeningItemKey(item)] ?? 0;
              const colour = LISTENING_KIND_COLOURS[listeningItemKind(item)] ?? '#4F7F32';
              return (
                <div
                  key={listeningItemKey(item)}
                  className="grid grid-cols-[minmax(0,12rem)_minmax(0,1fr)_2.25rem] items-center gap-2.5 text-[13px] font-semibold"
                >
                  <span className="truncate">{item.title}</span>
                  <span className="h-3 overflow-hidden rounded-md bg-cream-200">
                    <i
                      className="block h-full rounded-md"
                      style={{ width: `${(count / most) * 100}%`, background: colour }}
                    />
                  </span>
                  <span className="text-right text-bark-500 tabular-nums">{count}</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ value, label, vi }: { value: number; label: string; vi: string }) {
  return (
    <div className="rounded-[18px] bg-cream-100 p-3.5">
      <b className="block font-display text-3xl leading-none font-extrabold text-leaf-700 tabular-nums">
        {value}
      </b>
      <span className="text-xs leading-snug font-semibold text-bark-500">
        {label}
        <Vi>{vi}</Vi>
      </span>
    </div>
  );
}
