'use client';

import { useEffect } from 'react';
import { onCastMessage, sendToCast, useCast } from './cast';
import type { ReceiverMessage, SenderMessage } from './cast-protocol';
import { onScreenMessage, sendToScreen, useScreenLink } from './screen-link';

export interface TvLink {
  /** Which TV is showing the lesson: a Cast device or a laptop screen (never both). */
  kind: 'cast' | 'screen' | null;
  name: string | null;
}

/** The TV the lesson is sent to, over Google Cast or the laptop screen relay. */
export function useTvLink(): TvLink {
  const cast = useCast();
  const screen = useScreenLink();
  if (cast.status === 'connected') return { kind: 'cast', name: cast.device ?? 'TV' };
  if (screen === 'connected') return { kind: 'screen', name: 'Laptop' };
  return { kind: null, name: null };
}

/** Sends to whichever TV is connected (each sender ignores the call when it is not). Stable for effects. */
export function sendToTv(message: SenderMessage): void {
  sendToCast(message);
  sendToScreen(message);
}

/** Calls `listener` for messages from either kind of TV. */
export function useTvMessages(listener: (message: ReceiverMessage) => void): void {
  useEffect(() => {
    const stopCast = onCastMessage(listener);
    const stopScreen = onScreenMessage(listener);
    return () => {
      stopCast();
      stopScreen();
    };
  }, [listener]);
}
