'use client';

import type { ReactNode } from 'react';
import { DAYS_PER_WEEK_GOAL, listeningHomeMinutes, type ListeningPayload } from '@little-ants/shared';
import { UnitArt, ctaClass } from '@little-ants/ui/storybook';
import { leafState, leafWeeks, type LeafProgress, type LeafState } from '../lib/progress';
import type { Mode } from '../lib/types';
import { GoalLeaves, Vi } from './bits';
import { PlayIcon } from './icons';

/** Week names on the path (the leaves' stages fall on the same weeks in every unit). */
const WEEK_NAMES = [
  'Look back & meet',
  'Meet & join in',
  'Listen & join in',
  'Listen & join in',
  'Listen & join in',
  'Listen & join in',
  'Listen & join in',
  'Party & favourites',
];

const LEAF_STYLE: Record<LeafState, string> = {
  done: 'bg-leaf-600 text-white',
  next: 'bg-sun-400 text-bark-900 animate-bob',
  open: 'bg-cream-200 text-bark-500',
  locked: 'bg-cream-200 text-bark-500',
};

export interface PathViewProps {
  payload: ListeningPayload;
  progress: LeafProgress;
  mode: Mode;
  /** The leaf the big button plays: the next leaf at home, the lesson's leaf at school. */
  startLeaf: number;
  /** Days with listening this week (home). */
  daysThisWeek: number;
  /** Explains why the big button cannot start (daily limit), or null. */
  blocked: ReactNode;
  onPlay: (leaf: number) => void;
  /** Unit switcher, download button … shown under the hero. */
  tools?: ReactNode;
}

/** The Path: the unit hero with the big Play button and the 40 leaves in week rows of five. */
export function PathView({
  payload,
  progress,
  mode,
  startLeaf,
  daysThisWeek,
  blocked,
  onPlay,
  tools,
}: PathViewProps) {
  const school = mode === 'school';
  const minutes = listeningHomeMinutes(payload.unit.level.number);
  const picture = payload.unit.cover ?? payload.unit.leadCharacter?.image ?? null;
  const leaves = new Map(payload.leaves.map((leaf) => [leaf.number, leaf]));

  return (
    <div>
      <section className="my-2 grid items-center gap-5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div>
          <h1 className="font-display text-[clamp(30px,5vw,50px)] leading-none font-extrabold text-ant-500">
            {payload.unit.title}
          </h1>
          <p className="mt-1.5 font-semibold text-leaf-700">
            Listening Time ·{' '}
            {school ? 'In class with your teacher' : `At home, ${minutes.min}–${minutes.max} minutes a day`}
          </p>
          <p className="mt-1 max-w-[62ch] text-bark-500">
            {school ? (
              "Choose today's lesson. Play the leaf, then stand up, sing and say it together."
            ) : (
              <>
                Listen to one leaf every day. Four leaves this week makes your tree grow!
                <Vi>Mỗi ngày nghe một chiếc lá. Nghe 4 ngày trong tuần để cây lớn lên nhé!</Vi>
              </>
            )}
          </p>
          <div className="mt-3.5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={`${ctaClass} min-h-14 disabled:cursor-not-allowed disabled:opacity-50`}
              onClick={() => onPlay(startLeaf)}
              disabled={!!blocked}
            >
              <PlayIcon className="size-7" />
              {school ? `Play lesson ${startLeaf}` : `Play leaf ${startLeaf}`}
            </button>
            {school ? null : (
              <div className="flex items-center gap-2 text-sm font-semibold text-bark-500">
                <GoalLeaves days={daysThisWeek} />
                {Math.min(daysThisWeek, DAYS_PER_WEEK_GOAL)} of {DAYS_PER_WEEK_GOAL} days this week
              </div>
            )}
          </div>
          {blocked ? <div className="mt-3">{blocked}</div> : null}
          {tools ? <div className="mt-4 flex flex-wrap items-center gap-2">{tools}</div> : null}
        </div>
        <div className="aspect-video max-h-[42vh] w-full overflow-hidden rounded-[28px]">
          <UnitArt key={picture?.url} picture={picture} alt={payload.unit.title} className="size-full" />
        </div>
      </section>

      <div className="mt-6 flex flex-col gap-3.5">
        {leafWeeks().map((week, index) => (
          <div key={index} className="grid items-center gap-3 md:grid-cols-[96px_minmax(0,1fr)]">
            <div className="flex items-baseline gap-2 md:block">
              <span className="font-display text-xl leading-none font-extrabold">Week {index + 1}</span>
              <small className="block text-[11px] font-semibold tracking-wide text-bark-500 md:mt-1">
                {WEEK_NAMES[index]}
              </small>
            </div>
            <div className="leaf-trail relative grid grid-cols-5 gap-2.5">
              {week.map((number) => {
                const state = leafState(number, progress, mode, startLeaf);
                const minutesOf = leaves.get(number)?.minutes;
                const locked = state === 'locked';
                return (
                  <button
                    key={number}
                    type="button"
                    onClick={() => onPlay(number)}
                    aria-disabled={locked || undefined}
                    aria-label={`Leaf ${number}${state === 'done' ? ', done' : state === 'next' ? ', next' : locked ? ', not open yet' : ''}`}
                    className={`group relative flex flex-col items-center gap-1 rounded-xl px-0.5 py-1.5 ${locked ? 'cursor-not-allowed opacity-45' : ''}`}
                  >
                    <span
                      className={`leaf-shape grid aspect-square w-[min(70px,15vw)] place-items-center transition-transform group-hover:scale-105 ${LEAF_STYLE[state]}`}
                    >
                      <span className="font-display text-[clamp(17px,3vw,24px)] leading-none font-extrabold">
                        {number}
                      </span>
                    </span>
                    <span className="h-4 text-[13px] tracking-[-2px] text-sun-400" aria-hidden>
                      {state === 'done' ? '★★★' : ''}
                    </span>
                    <span className="text-center text-[11px] leading-tight font-semibold text-bark-500">
                      {minutesOf ? `${Math.round(minutesOf)} min` : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
