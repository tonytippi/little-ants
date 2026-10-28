'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import type { UnitReleasePayload } from '@little-ants/shared';
import { Spinner } from '@little-ants/ui/feedback';
import { Stage } from '../../components/player/stage';
import { clampPage } from '../../components/player/stage-content';
import { ReleaseGate } from '../../components/release-gate';
import { UnitArt } from '@little-ants/ui/storybook';
import {
  isPresenterMessage,
  presenterChannelName,
  type PresenterMessage,
  type StageView,
} from '../../lib/presenter';
import { RequireStaff } from '../../lib/session';

/** The TV / projector window: only the stage, driven by the teacher's window. */
function TvStage({
  payload,
  lessonNumber,
  session,
}: {
  payload: UnitReleasePayload;
  lessonNumber: number;
  session: string;
}) {
  const [state, setState] = useState<{ stepIndex: number; page: number; view: StageView } | null>(null);
  const [ended, setEnded] = useState(false);
  const [pageCount, setPageCount] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const onPageCount = useCallback((count: number) => setPageCount(Math.max(1, count)), []);
  const lesson = payload.lessons.find((item) => item.number === lessonNumber);

  useEffect(() => {
    const channel = new BroadcastChannel(presenterChannelName(session));
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (!isPresenterMessage(event.data)) return;
      if (event.data.type === 'state') {
        setEnded(false);
        setState({ stepIndex: event.data.stepIndex, page: event.data.page, view: event.data.view });
      }
      if (event.data.type === 'bye') setEnded(true);
    };
    channel.postMessage({ type: 'hello' } satisfies PresenterMessage);
    const bye = (): void => channel.postMessage({ type: 'bye' } satisfies PresenterMessage);
    window.addEventListener('beforeunload', bye);
    return () => {
      window.removeEventListener('beforeunload', bye);
      bye();
      channel.close();
    };
  }, [session]);

  useEffect(() => {
    const update = (): void => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);

  return (
    <div className="relative h-dvh w-screen overflow-hidden bg-cream-50">
      {state && lesson && !ended ? (
        <Stage
          presenter
          payload={payload}
          step={lesson.steps[state.stepIndex]}
          view={state.view}
          page={clampPage(state.page, pageCount)}
          onPageCount={onPageCount}
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
          <UnitArt
            picture={payload.unit.cover ?? payload.unit.leadCharacter?.image}
            className="h-[55vh] w-full max-w-5xl"
          />
          <p className="font-display text-[clamp(3rem,7vw,6rem)] font-extrabold leading-none text-ant-500">
            {payload.unit.title}
          </p>
          <p className="text-lg text-bark-500">
            {ended ? 'The teacher window was closed.' : 'Waiting for the teacher window…'}
          </p>
        </div>
      )}
      {fullscreen ? null : (
        <button
          type="button"
          onClick={() => void document.documentElement.requestFullscreen()}
          className="absolute right-4 top-4 rounded-xl bg-bark-900/80 px-4 py-3 text-sm font-bold text-white hover:bg-bark-900"
        >
          Move this window to the TV, then tap here for full screen
        </button>
      )}
    </div>
  );
}

function Present() {
  const params = useSearchParams();
  const unit = params.get('unit')?.toUpperCase() ?? null;
  const lesson = Number(params.get('lesson') ?? '1');
  const session = params.get('session') ?? '';
  const preview = params.get('preview') === '1';
  return (
    <ReleaseGate unit={unit} preview={preview}>
      {(payload) => <TvStage payload={payload} lessonNumber={lesson} session={session} />}
    </ReleaseGate>
  );
}

export default function PresentPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <RequireStaff appName="Teacher">
        <Present />
      </RequireStaff>
    </Suspense>
  );
}
