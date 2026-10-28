'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ListeningItem, ListeningPayload } from '@little-ants/shared';
import { ctaClass } from '@little-ants/ui/storybook';
import {
  firstSlide,
  planItem,
  stepAfter,
  usesDeviceVoice,
  type PlayerAction,
  type Slide,
} from '../../lib/player-plan';
import { ItemRunner } from '../../lib/player-runner';
import type { Mode } from '../../lib/types';
import { Vi } from '../bits';
import { AgainIcon, BackIcon, NextIcon, PauseIcon, PlayIcon, PrevIcon } from '../icons';
import { PlayerStage, PlayerText } from './player-stage';

export interface PlayerProps {
  payload: ListeningPayload;
  items: ListeningItem[];
  /** The leaf being played, or null for one item from the Library. */
  leaf: number | null;
  mode: Mode;
  /** Back to the path or the library (stops playback). */
  onExit: () => void;
  /** The leaf was played to the end: the keys of the items heard to their end. */
  onFinished: (itemsHeard: string[]) => void;
}

const EMPTY_SLIDE: Slide = { picture: null, lines: [], current: -1 };
/** A short breath between items. */
const BETWEEN_ITEMS_MS = 900;

/** Plays a leaf (or one item) with big controls a small child can use alone. */
export function Player({ payload, items, leaf, mode, onExit, onFinished }: PlayerProps) {
  // Fixed for this playthrough: a refreshed payload must not restart the item being played.
  const [plans] = useState(() => items.map((item) => planItem(item, payload, mode)));
  const [index, setIndex] = useState(0);
  const [run, setRun] = useState(0);
  const [slide, setSlide] = useState<Slide>(() =>
    plans[0]?.segments[0] ? firstSlide(plans[0].segments[0]) : EMPTY_SLIDE,
  );
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  const runner = useRef<ItemRunner | null>(null);
  const heard = useRef(new Set<string>());
  const indexRef = useRef(0);
  const advance = useRef<(action: PlayerAction) => void>(() => undefined);
  const school = mode === 'school';

  useEffect(() => {
    advance.current = (action) => {
      const step = stepAfter(indexRef.current, plans.length, action);
      if (step.heard && plans[indexRef.current]) heard.current.add(plans[indexRef.current]!.key);
      if (step.finished) {
        runner.current?.stop();
        setFinished(true);
        if (leaf !== null) onFinished([...heard.current]);
        return;
      }
      indexRef.current = step.index;
      setIndex(step.index);
      setPaused(false);
      setRun((value) => value + 1);
    };
  });

  // One <audio> element for the whole leaf: once a tap has started it, iPhone lets it play on by itself.
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    let timer: ReturnType<typeof setTimeout> | undefined;
    runner.current = new ItemRunner(audio, {
      slide: setSlide,
      progress: setProgress,
      blocked: () => setPaused(true),
      end: () => {
        timer = setTimeout(() => advance.current('ended'), BETWEEN_ITEMS_MS);
      },
    });
    return () => {
      clearTimeout(timer);
      runner.current?.stop();
      runner.current = null;
      audio.removeAttribute('src');
    };
  }, []);

  useEffect(() => {
    const plan = plans[index];
    if (plan && !finished) runner.current?.start(plan.segments);
  }, [plans, index, run, finished]);

  const togglePause = (): void => {
    const current = runner.current;
    if (!current) return;
    if (current.isPaused) current.resume();
    else current.pause();
    setPaused(current.isPaused);
  };

  if (finished) return <FinishScreen leaf={leaf} mode={mode} onExit={onExit} />;
  const plan = plans[index];
  if (!plan) return null;
  const voiceOnly =
    usesDeviceVoice(plan.segments) && !plan.segments.some((segment) => segment.type === 'audio');
  const backLabel = leaf === null ? 'Library' : school ? `Lesson ${leaf}` : `Leaf ${leaf}`;

  return (
    <div
      className="grid items-start gap-6 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]"
      style={{ ['--c' as string]: plan.colour }}
    >
      <div className="flex flex-wrap items-center gap-2.5 md:col-span-2">
        <button
          type="button"
          onClick={() => {
            runner.current?.stop();
            onExit();
          }}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 font-semibold text-bark-500 hover:bg-cream-100"
        >
          <BackIcon className="size-5" />
          {backLabel}
        </button>
        <span
          className="rounded-full px-3 py-1.5 text-xs leading-none font-bold tracking-wide text-white"
          style={{ background: plan.colour }}
        >
          {plan.act}
        </span>
        {plans.length > 1 ? (
          <span
            className="ml-auto flex flex-wrap gap-1.5"
            aria-label={`Part ${index + 1} of ${plans.length}`}
            role="img"
          >
            {plans.map((entry, position) => (
              <i
                key={position}
                className={`block size-3 rounded-full ${position < index ? 'bg-bark-500/45' : position === index ? '' : 'bg-cream-200'}`}
                style={position === index ? { background: plan.colour } : undefined}
              />
            ))}
          </span>
        ) : null}
      </div>

      <PlayerStage slide={slide} colour={plan.colour} cover={plan.kind === 'TALK_SCENE'} />

      <div className="flex min-w-0 flex-col gap-3.5">
        <div>
          <div className="text-[13px] font-semibold tracking-wider text-bark-500 uppercase">
            {plan.kindLabel}
          </div>
          <h2
            className={`font-display leading-[1.05] font-extrabold ${school ? 'text-[clamp(30px,4vw,56px)]' : 'text-[clamp(26px,3.6vw,40px)]'}`}
            style={{ color: plan.colour }}
          >
            {plan.title}
          </h2>
        </div>
        <div className="rounded-2xl bg-cream-100 px-3.5 py-3 font-semibold">
          <b
            className="mb-0.5 block font-display text-lg leading-tight font-extrabold"
            style={{ color: plan.colour }}
          >
            {plan.act}
          </b>
          {plan.cue}
        </div>
        <PlayerText slide={slide} colour={plan.colour} large={school} />
        <div className="flex flex-wrap items-center gap-3.5">
          <ControlButton label="Previous" onClick={() => advance.current('previous')} disabled={index === 0}>
            <PrevIcon className="size-7" />
          </ControlButton>
          <button
            type="button"
            onClick={togglePause}
            aria-label={paused ? 'Play' : 'Pause'}
            className="grid size-20 place-items-center rounded-full text-white shadow-[0_5px_0_rgba(0,0,0,0.18)] active:translate-y-0.5"
            style={{ background: plan.colour }}
          >
            {paused ? <PlayIcon className="size-9" /> : <PauseIcon className="size-9" />}
          </button>
          <ControlButton label="Next" onClick={() => advance.current('next')}>
            <NextIcon className="size-7" />
          </ControlButton>
          <ControlButton label="Again" onClick={() => advance.current('again')}>
            <AgainIcon className="size-7" />
          </ControlButton>
          <span className="h-1.5 min-w-32 flex-1 overflow-hidden rounded-md bg-cream-200" aria-hidden>
            <i
              className="block h-full transition-[width] duration-300"
              style={{ width: `${Math.round(progress * 100)}%`, background: plan.colour }}
            />
          </span>
        </div>
        {voiceOnly ? (
          <p className="text-xs font-medium text-bark-500">
            Practice voice – the studio recording is coming soon.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ControlButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid size-15 place-items-center rounded-full bg-cream-200 text-bark-900 hover:bg-cream-100 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function FinishScreen({ leaf, mode, onExit }: { leaf: number | null; mode: Mode; onExit: () => void }) {
  return (
    <div className="py-8 text-center">
      <div className="text-[54px] tracking-[6px] text-sun-400" aria-hidden>
        ★★★
      </div>
      <h2 className="font-display text-[44px] leading-tight font-extrabold text-leaf-700">
        Well done, Little Ant!
      </h2>
      <p className="mx-auto mt-2 mb-5 max-w-[50ch] text-bark-500">
        {leaf === null ? (
          'Great listening!'
        ) : mode === 'school' ? (
          `Lesson ${leaf} listening is done.`
        ) : (
          <>
            Leaf {leaf} is green now.
            <Vi>Chiếc lá {leaf} đã chuyển xanh.</Vi>
          </>
        )}
      </p>
      <button type="button" className={ctaClass} onClick={onExit} autoFocus>
        <BackIcon className="size-6" strokeWidth={3} />
        {leaf === null ? 'Back to the library' : 'Back to the path'}
      </button>
    </div>
  );
}
