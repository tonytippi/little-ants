'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import type { UnitReleasePayload } from '@little-ants/shared';
import { Button, buttonClass } from '@little-ants/ui/button';
import { Badge } from '@little-ants/ui/badge';
import { useCast } from '../../lib/cast';
import type { AudioStatus, InkMessage, ReceiverMessage } from '../../lib/cast-protocol';
import { formatClock, stageLabel } from '../../lib/format';
import { useElapsedSeconds } from '../../lib/hooks';
import {
  EMPTY_SURFACE,
  inkCommit,
  inkRedo,
  inkUndo,
  surfaceKey,
  type InkStroke,
  type InkSurface,
} from '../../lib/ink';
import { links } from '../../lib/links';
import { NOTE_SIZES, useNoteSize } from '../../lib/note-size';
import { useScreenLink } from '../../lib/screen-link';
import { sendToTv, useTvLink, useTvMessages } from '../../lib/tv-link';
import {
  isPresenterMessage,
  presenterChannelName,
  type PresenterMessage,
  type StageView,
} from '../../lib/presenter';
import { AudioBar } from './audio-bar';
import { FinishDialog } from './finish-dialog';
import { InkLayer } from './ink-layer';
import { NotesPanel } from './notes-panel';
import { Stage } from './stage';
import { audioFor, buildStageFrame, clampPage, materialForStep, splashFrame } from './stage-content';
import { StepRail } from './step-rail';
import { TvMenu } from './tv-menu';
import { HiddenBadge, WideStage } from './wide-stage';

interface Props {
  payload: UnitReleasePayload;
  lessonNumber: number;
  classId: string | null;
  preview?: boolean;
}

export function LessonPlayer({ payload, lessonNumber, classId, preview = false }: Props) {
  const router = useRouter();
  const lesson = payload.lessons.find((item) => item.number === lessonNumber);
  const steps = useMemo(() => lesson?.steps ?? [], [lesson]);
  const [stepIndex, setStepIndex] = useState(0);
  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [view, setView] = useState<StageView>('material');
  // Notes start open on wide screens (laptop) and closed on tablets, where they cover the stage.
  const [notesOpen, setNotesOpen] = useState(
    () => typeof window === 'undefined' || window.innerWidth >= 1024,
  );
  const [lessonStart] = useState(() => Date.now());
  const [stepStart, setStepStart] = useState(() => Date.now());
  const [session, setSession] = useState<string | null>(null);
  const [windowConnected, setWindowConnected] = useState(false);
  const cast = useCast();
  const screen = useScreenLink();
  const tv = useTvLink();
  const casting = tv.kind !== null;
  const [tvAudio, setTvAudio] = useState<AudioStatus | null>(null);
  const [tvReady, setTvReady] = useState(0);
  const [noteSize, setNoteSize] = useNoteSize();
  const [finishing, setFinishing] = useState(false);
  // The TV shows the logo instead of the stage until the teacher shows it again.
  const [hidden, setHidden] = useState(false);
  const [pauseSignal, setPauseSignal] = useState(0);
  const [wide, setWide] = useState(false);
  const [inks, setInks] = useState<Record<string, InkSurface>>({});
  const channel = useRef<BroadcastChannel | null>(null);
  const swipeStart = useRef<number | null>(null);

  const step = steps[stepIndex];
  const material = view === 'material' ? materialForStep(payload, step) : undefined;
  const shownPage = clampPage(page, pageCount);
  const frame = useMemo(
    () => buildStageFrame(payload, step, view, shownPage, surfaceKey(stepIndex, view, shownPage)),
    [payload, step, view, shownPage, stepIndex],
  );
  // While hidden, the TV gets nothing of the lesson (no material, words or ink), only the logo.
  const tvFrame = useMemo(() => (hidden ? splashFrame() : frame), [hidden, frame]);
  const ink = inks[frame.surface] ?? EMPTY_SURFACE;
  // With a TV showing the stage, the teacher's screen puts the notes first.
  const withTv = casting || windowConnected;
  const lessonSeconds = useElapsedSeconds(lessonStart, true);
  const stepSeconds = useElapsedSeconds(stepStart, true);
  const stepLeft = (step?.minutes ?? 0) * 60 - stepSeconds;

  const goToStep = useCallback(
    (index: number) => {
      const next = Math.min(Math.max(0, index), steps.length - 1);
      setStepIndex(next);
      setPage(0);
      setView('material');
      setStepStart(Date.now());
    },
    [steps.length],
  );

  const forward = useCallback(() => {
    if (page < pageCount - 1) setPage(page + 1);
    else if (stepIndex < steps.length - 1) goToStep(stepIndex + 1);
  }, [page, pageCount, stepIndex, steps.length, goToStep]);

  const backward = useCallback(() => {
    if (page > 0) setPage(page - 1);
    else if (stepIndex > 0) goToStep(stepIndex - 1);
  }, [page, stepIndex, goToStep]);

  const onPageCount = useCallback((count: number) => setPageCount(Math.max(1, count)), []);

  const toggleHidden = useCallback(() => {
    // Hiding pauses the audio; showing again does not restart it.
    if (!hidden) setPauseSignal((count) => count + 1);
    setHidden(!hidden);
  }, [hidden]);
  const closeWide = useCallback(() => setWide(false), []);

  // Keyboard and presentation clickers (they send PageDown / PageUp).
  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (['ArrowRight', 'PageDown', ' '].includes(event.key)) {
        event.preventDefault();
        forward();
      } else if (['ArrowLeft', 'PageUp'].includes(event.key)) {
        event.preventDefault();
        backward();
      } else if (event.key === 'ArrowDown') {
        goToStep(stepIndex + 1);
      } else if (event.key === 'ArrowUp') {
        goToStep(stepIndex - 1);
      } else if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) {
        return;
      } else if (event.key.toLowerCase() === 'h' && withTv) {
        toggleHidden();
      } else if (event.key.toLowerCase() === 'w') {
        setWide((open) => !open);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [forward, backward, goToStep, stepIndex, withTv, toggleHidden]);

  // Presenter mode: keep the TV window in step with this one.
  useEffect(() => {
    if (!session) return;
    const bc = new BroadcastChannel(presenterChannelName(session));
    channel.current = bc;
    bc.onmessage = (event: MessageEvent<unknown>) => {
      if (!isPresenterMessage(event.data)) return;
      if (event.data.type === 'hello') setWindowConnected(true);
      if (event.data.type === 'bye') setWindowConnected(false);
    };
    return () => {
      bc.postMessage({ type: 'bye' } satisfies PresenterMessage);
      bc.close();
      channel.current = null;
    };
  }, [session]);

  useEffect(() => {
    channel.current?.postMessage({ type: 'state', frame: tvFrame } satisfies PresenterMessage);
  }, [tvFrame, windowConnected, session]);

  // Chromecast or laptop screen: the TV follows the same frames; it asks again ('ready') when it (re)connects.
  useEffect(() => {
    if (casting) sendToTv({ type: 'frame', frame: tvFrame });
  }, [tvFrame, casting, tvReady]);

  const sendInk = useCallback(
    (message: InkMessage) => {
      if (hidden) return;
      channel.current?.postMessage(message satisfies PresenterMessage);
      if (casting) sendToTv(message);
    },
    [hidden, casting],
  );

  // The page's ink follows its frame, and again after Show on TV or when a TV (re)connects.
  useEffect(() => {
    sendInk({ type: 'ink', key: frame.surface, strokes: ink.strokes });
  }, [sendInk, frame.surface, ink.strokes, windowConnected, tvReady]);

  const surface = frame.surface;
  const editInk = useCallback(
    (change: (current: InkSurface) => InkSurface) =>
      setInks((all) => ({ ...all, [surface]: change(all[surface] ?? EMPTY_SURFACE) })),
    [surface],
  );
  const onLiveStroke = useCallback(
    (stroke: InkStroke) => sendInk({ type: 'ink-live', key: surface, stroke }),
    [sendInk, surface],
  );
  const onStroke = useCallback(
    (stroke: InkStroke) => editInk((current) => inkCommit(current, [...current.strokes, stroke])),
    [editInk],
  );
  const onErase = useCallback(
    (ids: string[]) =>
      editInk((current) =>
        inkCommit(
          current,
          current.strokes.filter((stroke) => !ids.includes(stroke.id)),
        ),
      ),
    [editInk],
  );

  const onTvMessage = useCallback((message: ReceiverMessage) => {
    if (message.type === 'ready') setTvReady((count) => count + 1);
    else setTvAudio(message);
  }, []);
  useTvMessages(onTvMessage);

  function openTv(): void {
    const id = session ?? crypto.randomUUID();
    setSession(id);
    window.open(
      links.present(payload.unit.code, lessonNumber, id, preview),
      `la-tv-${id}`,
      'popup,width=1280,height=720',
    );
  }

  if (!lesson) {
    return (
      <div className="p-8">
        <p className="text-lg font-semibold">
          Lesson {lessonNumber} is not in {payload.unit.code}.
        </p>
        <Link
          href={links.unit(payload.unit.code, classId)}
          className={buttonClass('secondary', 'md', 'mt-4')}
        >
          Back to the unit
        </Link>
      </div>
    );
  }

  const tracks = view === 'material' ? audioFor(material, page) : [];
  const remoteAudio = casting ? { status: tvAudio, send: sendToTv, resync: tvReady } : undefined;
  const pageLabel =
    pageCount > 1
      ? `Page ${clampPage(page, pageCount) + 1} / ${pageCount}`
      : `Step ${stepIndex + 1} / ${steps.length}`;

  function onPointerDown(event: PointerEvent): void {
    swipeStart.current = event.clientX;
  }
  function onPointerUp(event: PointerEvent): void {
    if (swipeStart.current === null) return;
    const dx = event.clientX - swipeStart.current;
    swipeStart.current = null;
    if (Math.abs(dx) > 60) (dx < 0 ? forward : backward)();
  }

  return (
    <div className="flex h-dvh flex-col bg-cream-100">
      {preview ? (
        <div className="bg-sun-400 px-4 py-1.5 text-center text-sm font-bold text-bark-900">
          Preview — draft content, nothing is recorded
        </div>
      ) : null}
      <header className="flex flex-wrap items-center gap-2 border-b border-cream-200 bg-white px-3 py-2">
        <Link
          href={preview ? links.preview(payload.unit.code) : links.unit(payload.unit.code, classId)}
          className="rounded-lg px-2 py-2 text-sm font-semibold text-bark-500 hover:bg-cream-100"
        >
          ← {payload.unit.code}
        </Link>
        <div className="min-w-0">
          <p className="truncate font-extrabold text-bark-900">
            Lesson {lesson.number} · {payload.unit.title}
          </p>
          <p className="text-xs text-bark-500">
            Week {lesson.week} · {stageLabel(lesson.stage)}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span
            className="rounded-lg bg-cream-100 px-2.5 py-1.5 text-sm tabular-nums text-bark-700"
            title="Time since the lesson started"
          >
            ⏱ {formatClock(lessonSeconds)} / {lesson.minutes}:00
          </span>
          <span
            className={`rounded-lg px-2.5 py-1.5 text-sm font-bold tabular-nums ${stepLeft < 0 ? 'bg-ant-50 text-ant-700' : 'bg-leaf-50 text-leaf-700'}`}
            title="Time left for this step"
            aria-live="off"
          >
            Step {formatClock(stepLeft)}
          </span>
          <Button
            size="md"
            variant={view === 'words' ? 'primary' : 'secondary'}
            onClick={() => {
              setView(view === 'words' ? 'material' : 'words');
              setPage(0);
            }}
          >
            Word cards
          </Button>
          {withTv ? (
            <Button
              size="md"
              variant={hidden ? 'primary' : 'secondary'}
              onClick={toggleHidden}
              aria-pressed={hidden}
              title="Keyboard: H"
            >
              {hidden ? 'Show on TV' : 'Hide on TV'}
            </Button>
          ) : null}
          <Button
            size="md"
            variant="secondary"
            onClick={() => setWide(true)}
            title="Draw on the stage (keyboard: W)"
          >
            Wide
          </Button>
          {withTv ? null : (
            <Button
              size="md"
              variant="secondary"
              onClick={() => setNotesOpen(!notesOpen)}
              aria-pressed={notesOpen}
            >
              Notes
            </Button>
          )}
          <TvMenu
            cast={cast}
            screen={screen}
            tv={tv}
            windowConnected={windowConnected}
            windowOpen={session !== null}
            onOpenWindow={openTv}
          />
          <Button
            size="md"
            variant="accent"
            onClick={() => {
              if (preview) router.back();
              else setFinishing(true);
            }}
          >
            {preview ? 'Close' : 'Finish'}
          </Button>
        </div>
      </header>

      <div className={`flex min-h-0 flex-1 ${withTv ? 'flex-col landscape:flex-row' : ''}`}>
        <section
          className={`flex min-w-0 flex-col gap-3 p-3 ${withTv ? 'shrink-0 portrait:h-[42%] landscape:w-[42%]' : 'flex-1'}`}
          aria-label={withTv ? 'What the TV shows' : 'Lesson stage'}
        >
          <div
            className="relative min-h-0 flex-1 touch-pan-y select-none overflow-hidden rounded-3xl bg-cream-50 ring-1 ring-cream-200"
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
          >
            <Stage frame={frame} onPageCount={onPageCount} ink={<InkLayer strokes={ink.strokes} />} />
            {hidden && withTv ? <HiddenBadge /> : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Button size="lg" variant="secondary" onClick={backward} aria-label="Back">
                ◀
              </Button>
              <span className="min-w-20 text-center text-sm font-semibold tabular-nums text-bark-700">
                {pageLabel}
              </span>
              <Button size="lg" onClick={forward} aria-label="Next">
                ▶
              </Button>
            </div>
            <div className="min-w-64 flex-1">
              <AudioBar tracks={tracks} remote={remoteAudio} pauseSignal={pauseSignal} />
              {casting && tvAudio?.blocked ? (
                <p className="mt-1 text-sm font-semibold text-ant-700">
                  The TV is not allowed to play sound yet: tap the laptop screen once.
                </p>
              ) : null}
            </div>
          </div>
        </section>

        {notesOpen || withTv ? (
          <aside
            className={
              withTv
                ? 'min-h-0 min-w-0 flex-1 overflow-y-auto border-cream-200 bg-white p-5 portrait:border-t landscape:border-l'
                : 'fixed inset-y-0 right-0 z-30 w-[min(24rem,90vw)] overflow-y-auto border-l border-cream-200 bg-white p-5 shadow-xl lg:static lg:z-auto lg:shadow-none'
            }
            aria-label="Teacher notes"
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-ant-600">Step {stepIndex + 1}</p>
                <h2 className="font-extrabold text-bark-900">{step?.title}</h2>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => setNoteSize(noteSize - 1)}
                  disabled={noteSize === 0}
                  className="rounded-lg px-2.5 py-1.5 text-sm font-bold text-bark-700 hover:bg-cream-100 disabled:opacity-40"
                  aria-label="Smaller note text"
                >
                  A−
                </button>
                <button
                  type="button"
                  onClick={() => setNoteSize(noteSize + 1)}
                  disabled={noteSize === NOTE_SIZES.length - 1}
                  className="rounded-lg px-2.5 py-1.5 text-lg font-bold text-bark-700 hover:bg-cream-100 disabled:opacity-40"
                  aria-label="Larger note text"
                >
                  A+
                </button>
                {withTv ? null : (
                  <button
                    type="button"
                    onClick={() => setNotesOpen(false)}
                    className="rounded-lg px-2 py-1 text-bark-500 hover:bg-cream-100 lg:hidden"
                    aria-label="Close notes"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
            {lesson.newToday.length ? (
              <p className="mb-4 flex flex-wrap items-center gap-1 text-xs text-bark-500">
                NEW today:{' '}
                {lesson.newToday.map((code) => (
                  <Badge key={code} tone="ant">
                    {code}
                  </Badge>
                ))}
              </p>
            ) : null}
            <NotesPanel
              lesson={lesson}
              step={step}
              material={materialForStep(payload, step)}
              size={noteSize}
            />
          </aside>
        ) : null}
      </div>

      <footer className="border-t border-cream-200 bg-white px-2 py-2">
        <StepRail steps={steps} current={stepIndex} onSelect={goToStep} />
      </footer>

      {wide ? (
        <WideStage
          frame={frame}
          strokes={ink.strokes}
          onLive={onLiveStroke}
          onStroke={onStroke}
          onErase={onErase}
          onUndo={() => editInk(inkUndo)}
          onRedo={() => editInk(inkRedo)}
          onClear={() => editInk((current) => inkCommit(current, []))}
          canUndo={ink.undo.length > 0}
          canRedo={ink.redo.length > 0}
          pageLabel={pageLabel}
          onBack={backward}
          onForward={forward}
          tv={withTv ? { hidden, onToggle: toggleHidden } : null}
          onExit={closeWide}
          onSwipeStart={onPointerDown}
          onSwipeEnd={onPointerUp}
        />
      ) : null}

      {preview ? null : (
        <FinishDialog
          open={finishing}
          onClose={() => setFinishing(false)}
          onDone={() => {
            sendToTv({ type: 'end' });
            router.push(links.home());
          }}
          unitCode={payload.unit.code}
          lessonNumber={lesson.number}
          releaseVersion={payload.version}
          classId={classId}
        />
      )}
    </div>
  );
}
