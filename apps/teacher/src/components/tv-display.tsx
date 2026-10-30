'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { StageFrame } from './player/stage-content';
import { ReceivedInkLayer, useReceivedInk } from './player/ink-layer';
import { Stage } from './player/stage';
import {
  isSenderMessage,
  type AudioCommand,
  type ReceiverMessage,
  type SenderMessage,
} from '../lib/cast-protocol';

/** How a TV screen talks to the teacher's device: Google Cast, or the API relay for laptop screens. */
export interface DisplayLink {
  /** Starts receiving; `onIdle` means no teacher is connected any more. Returns a cleanup. */
  connect(handlers: { onMessage: (message: SenderMessage) => void; onIdle: () => void }): () => void;
  send(message: ReceiverMessage): void;
}

/**
 * What runs on the classroom TV: shows the stage frames and plays the audio the teacher's device sends.
 * It has no data of its own.
 */
export function TvDisplay({ link, waiting }: { link: DisplayLink | null; waiting?: ReactNode }) {
  const [frame, setFrame] = useState<StageFrame | null>(null);
  const [ink, onInk, clearInk] = useReceivedInk();
  const audio = useRef<HTMLAudioElement | null>(null);
  const blocked = useRef(false);

  const reportAudio = useCallback(() => {
    const element = audio.current;
    if (!element || !link) return;
    link.send({
      type: 'audio-status',
      trackId: element.dataset.trackId || null,
      playing: !element.paused,
      current: element.currentTime || 0,
      duration: Number.isFinite(element.duration) ? element.duration : 0,
      blocked: blocked.current,
    });
  }, [link]);

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
          element.play().then(
            () => {
              blocked.current = false;
            },
            () => {
              // Autoplay rules: a laptop browser needs one tap on the page before it plays sound.
              blocked.current = true;
              reportAudio();
            },
          );
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
    if (!link) return;
    const stop = (): void => {
      setFrame(null);
      clearInk();
      runAudio({ type: 'audio', action: 'load', track: null });
    };
    return link.connect({
      onMessage: (message) => {
        if (!isSenderMessage(message)) return;
        if (message.type === 'frame') setFrame(message.frame);
        else if (message.type === 'end') stop();
        else if (message.type === 'ink' || message.type === 'ink-live') onInk(message);
        else runAudio(message);
      },
      onIdle: stop,
    });
  }, [link, runAudio, onInk, clearInk]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-cream-50">
      <audio ref={audio} preload="auto" />
      {frame ? (
        <Stage presenter frame={frame} ink={<ReceivedInkLayer ink={ink} surface={frame.surface} />} />
      ) : (
        (waiting ?? (
          <div className="flex h-full flex-col items-center justify-center gap-6 p-8 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" className="size-40" />
            <p className="font-display text-[clamp(3rem,6vw,5rem)] font-extrabold leading-none text-ant-500">
              Little Ants English
            </p>
            <p className="text-2xl text-bark-500">Waiting for the teacher…</p>
          </div>
        ))
      )}
    </div>
  );
}
