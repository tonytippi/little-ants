'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import type { UnitReleasePayload } from '@little-ants/shared';
import { Button, buttonClass } from '@little-ants/ui/button';
import { Badge } from '@little-ants/ui/badge';
import { formatClock, stageLabel } from '../../lib/format';
import { useElapsedSeconds } from '../../lib/hooks';
import { links } from '../../lib/links';
import {
  isPresenterMessage,
  presenterChannelName,
  type PresenterMessage,
  type StageView,
} from '../../lib/presenter';
import { AudioBar } from './audio-bar';
import { FinishDialog } from './finish-dialog';
import { NotesPanel } from './notes-panel';
import { Stage } from './stage';
import { audioFor, clampPage, materialForStep } from './stage-content';
import { StepRail } from './step-rail';

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
  const [tvConnected, setTvConnected] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const channel = useRef<BroadcastChannel | null>(null);
  const swipeStart = useRef<number | null>(null);

  const step = steps[stepIndex];
  const material = view === 'material' ? materialForStep(payload, step) : undefined;
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
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [forward, backward, goToStep, stepIndex]);

  // Presenter mode: keep the TV window in step with this one.
  useEffect(() => {
    if (!session) return;
    const bc = new BroadcastChannel(presenterChannelName(session));
    channel.current = bc;
    bc.onmessage = (event: MessageEvent<unknown>) => {
      if (!isPresenterMessage(event.data)) return;
      if (event.data.type === 'hello') setTvConnected(true);
      if (event.data.type === 'bye') setTvConnected(false);
    };
    return () => {
      bc.postMessage({ type: 'bye' } satisfies PresenterMessage);
      bc.close();
      channel.current = null;
    };
  }, [session]);

  useEffect(() => {
    channel.current?.postMessage({ type: 'state', stepIndex, page, view } satisfies PresenterMessage);
  }, [stepIndex, page, view, tvConnected, session]);

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
          <Button
            size="md"
            variant="secondary"
            onClick={() => setNotesOpen(!notesOpen)}
            aria-pressed={notesOpen}
          >
            Notes
          </Button>
          <Button
            size="md"
            variant={session ? 'primary' : 'secondary'}
            onClick={openTv}
            title="Open a second window for the TV or projector"
          >
            {session ? (tvConnected ? 'TV on' : 'TV window…') : 'Show on TV'}
          </Button>
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

      <div className="flex min-h-0 flex-1">
        <section className="flex min-w-0 flex-1 flex-col gap-3 p-3" aria-label="Lesson stage">
          <div
            className="relative min-h-0 flex-1 touch-pan-y select-none overflow-hidden rounded-3xl bg-cream-50 ring-1 ring-cream-200"
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
          >
            <Stage
              payload={payload}
              step={step}
              view={view}
              page={clampPage(page, pageCount)}
              onPageCount={onPageCount}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Button size="lg" variant="secondary" onClick={backward} aria-label="Back">
                ◀
              </Button>
              <span className="min-w-20 text-center text-sm font-semibold tabular-nums text-bark-700">
                {pageCount > 1
                  ? `Page ${clampPage(page, pageCount) + 1} / ${pageCount}`
                  : `Step ${stepIndex + 1} / ${steps.length}`}
              </span>
              <Button size="lg" onClick={forward} aria-label="Next">
                ▶
              </Button>
            </div>
            <div className="min-w-64 flex-1">
              <AudioBar tracks={tracks} />
            </div>
          </div>
        </section>

        {notesOpen ? (
          <aside
            className="fixed inset-y-0 right-0 z-30 w-[min(24rem,90vw)] overflow-y-auto border-l border-cream-200 bg-white p-5 shadow-xl lg:static lg:z-auto lg:shadow-none"
            aria-label="Teacher notes"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-ant-500">Step {stepIndex + 1}</p>
                <h2 className="font-extrabold text-bark-900">{step?.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => setNotesOpen(false)}
                className="rounded-lg px-2 py-1 text-bark-500 hover:bg-cream-100 lg:hidden"
                aria-label="Close notes"
              >
                ✕
              </button>
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
            <NotesPanel lesson={lesson} step={step} material={materialForStep(payload, step)} />
          </aside>
        ) : null}
      </div>

      <footer className="border-t border-cream-200 bg-white px-2 py-2">
        <StepRail steps={steps} current={stepIndex} onSelect={goToStep} />
      </footer>

      {preview ? null : (
        <FinishDialog
          open={finishing}
          onClose={() => setFinishing(false)}
          onDone={() => router.push(links.home())}
          unitCode={payload.unit.code}
          lessonNumber={lesson.number}
          releaseVersion={payload.version}
          classId={classId}
        />
      )}
    </div>
  );
}
