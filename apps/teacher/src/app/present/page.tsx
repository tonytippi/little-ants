'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import type { UnitReleasePayload } from '@little-ants/shared';
import { Spinner } from '@little-ants/ui/feedback';
import { ReceivedInkLayer, useReceivedInk } from '../../components/player/ink-layer';
import { Stage } from '../../components/player/stage';
import type { StageFrame } from '../../components/player/stage-content';
import { ReleaseGate } from '../../components/release-gate';
import { UnitArt } from '@little-ants/ui/storybook';
import { isPresenterMessage, presenterChannelName, type PresenterMessage } from '../../lib/presenter';
import { RequireStaff } from '../../lib/session';

/** The TV / projector window: only the stage, driven by the teacher's window. */
function TvStage({ payload, session }: { payload: UnitReleasePayload; session: string }) {
  const [frame, setFrame] = useState<StageFrame | null>(null);
  const [ended, setEnded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [ink, onInk] = useReceivedInk();

  useEffect(() => {
    const channel = new BroadcastChannel(presenterChannelName(session));
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (!isPresenterMessage(event.data)) return;
      if (event.data.type === 'state') {
        setEnded(false);
        setFrame(event.data.frame);
      }
      if (event.data.type === 'bye') setEnded(true);
      if (event.data.type === 'ink' || event.data.type === 'ink-live') onInk(event.data);
    };
    channel.postMessage({ type: 'hello' } satisfies PresenterMessage);
    const bye = (): void => channel.postMessage({ type: 'bye' } satisfies PresenterMessage);
    window.addEventListener('beforeunload', bye);
    return () => {
      window.removeEventListener('beforeunload', bye);
      bye();
      channel.close();
    };
  }, [session, onInk]);

  useEffect(() => {
    const update = (): void => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden bg-cream-50">
      {frame && !ended ? (
        <Stage presenter frame={frame} ink={<ReceivedInkLayer ink={ink} surface={frame.surface} />} />
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
  const session = params.get('session') ?? '';
  const preview = params.get('preview') === '1';
  return (
    <ReleaseGate unit={unit} preview={preview}>
      {(payload) => <TvStage payload={payload} session={session} />}
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
