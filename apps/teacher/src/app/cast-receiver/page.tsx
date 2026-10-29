'use client';

import Script from 'next/script';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Stage } from '../../components/player/stage';
import type { StageFrame } from '../../components/player/stage-content';
import {
  CAST_NAMESPACE,
  isSenderMessage,
  type AudioCommand,
  type ReceiverMessage,
} from '../../lib/cast-protocol';

/** The parts of the Cast Web Receiver SDK this page uses (loaded from gstatic, so no npm types). */
interface ReceiverContext {
  addCustomMessageListener(
    namespace: string,
    listener: (event: { senderId: string; data: unknown }) => void,
  ): void;
  sendCustomMessage(namespace: string, senderId: string | undefined, data: ReceiverMessage): void;
  addEventListener(type: string, listener: (event: { senderId: string }) => void): void;
  getSenders(): unknown[];
  start(options: { disableIdleTimeout: boolean; customNamespaces: Record<string, string> }): void;
}

interface ReceiverSdk {
  framework: {
    CastReceiverContext: { getInstance(): ReceiverContext };
    system: {
      EventType: { SENDER_CONNECTED: string; SENDER_DISCONNECTED: string };
      MessageType: { JSON: string };
    };
  };
}

const RECEIVER_SDK = 'https://www.gstatic.com/cast/sdk/libs/caf_receiver/v3/cast_receiver_framework.js';

/**
 * Runs on the classroom TV as the Google Cast receiver. It has no login and no data of its own:
 * it shows the stage frames and plays the audio the teacher's device sends.
 */
export default function CastReceiverPage() {
  const [frame, setFrame] = useState<StageFrame | null>(null);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const context = useRef<ReceiverContext | null>(null);

  const reportAudio = useCallback(() => {
    const element = audio.current;
    if (!element) return;
    context.current?.sendCustomMessage(CAST_NAMESPACE, undefined, {
      type: 'audio-status',
      trackId: element.dataset.trackId || null,
      playing: !element.paused,
      current: element.currentTime || 0,
      duration: Number.isFinite(element.duration) ? element.duration : 0,
    });
  }, []);

  const runAudio = useCallback(
    (command: AudioCommand) => {
      const element = audio.current;
      if (!element) return;
      switch (command.action) {
        case 'load':
          element.pause();
          element.dataset.trackId = command.track?.id ?? '';
          if (command.track) element.src = command.track.url;
          else element.removeAttribute('src');
          break;
        case 'play':
          void element.play().catch(reportAudio);
          break;
        case 'pause':
          element.pause();
          break;
        case 'seek':
          element.currentTime = command.time;
          break;
      }
      reportAudio();
    },
    [reportAudio],
  );

  useEffect(() => {
    const element = audio.current;
    if (!element) return;
    const events = ['play', 'pause', 'ended', 'loadedmetadata', 'seeked'];
    events.forEach((name) => element.addEventListener(name, reportAudio));
    const timer = window.setInterval(() => {
      if (!element.paused) reportAudio();
    }, 1000);
    return () => {
      events.forEach((name) => element.removeEventListener(name, reportAudio));
      window.clearInterval(timer);
    };
  }, [reportAudio]);

  useEffect(() => {
    if (!sdkLoaded) return;
    const sdk = (window as unknown as { cast?: ReceiverSdk }).cast;
    if (!sdk || context.current) return;
    const { CastReceiverContext, system } = sdk.framework;
    const receiver = CastReceiverContext.getInstance();
    context.current = receiver;
    receiver.addCustomMessageListener(CAST_NAMESPACE, (event) => {
      const message = event.data;
      if (!isSenderMessage(message)) return;
      if (message.type === 'frame') setFrame(message.frame);
      else if (message.type === 'end') {
        setFrame(null);
        runAudio({ type: 'audio', action: 'load', track: null });
      } else runAudio(message);
    });
    receiver.addEventListener(system.EventType.SENDER_CONNECTED, (event) => {
      receiver.sendCustomMessage(CAST_NAMESPACE, event.senderId, { type: 'ready' });
    });
    receiver.addEventListener(system.EventType.SENDER_DISCONNECTED, () => {
      if (receiver.getSenders().length === 0) {
        setFrame(null);
        runAudio({ type: 'audio', action: 'load', track: null });
      }
    });
    // A lesson can stay on one page for a long time: never close the receiver for being idle.
    receiver.start({
      disableIdleTimeout: true,
      customNamespaces: { [CAST_NAMESPACE]: system.MessageType.JSON },
    });
  }, [sdkLoaded, runAudio]);

  return (
    <div className="relative h-dvh w-screen overflow-hidden bg-cream-50">
      <Script src={RECEIVER_SDK} strategy="afterInteractive" onReady={() => setSdkLoaded(true)} />
      <audio ref={audio} preload="auto" />
      {frame ? (
        <Stage presenter frame={frame} />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-6 p-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className="size-40" />
          <p className="font-display text-[clamp(3rem,6vw,5rem)] font-extrabold leading-none text-ant-500">
            Little Ants English
          </p>
          <p className="text-2xl text-bark-500">Waiting for the teacher…</p>
        </div>
      )}
    </div>
  );
}
