'use client';

import type { ListenMessage, NewScreen, ScreenControllerKind, ScreenDisplayEvent } from '@little-ants/shared';
import type { DisplayLink } from '../components/tv-display';
import { API_URL } from './api';
import type { SenderMessage } from './cast-protocol';

export type ScreenState =
  | { kind: 'starting' }
  | { kind: 'code'; code: string }
  | { kind: 'paired'; by: ScreenControllerKind; name: string }
  | { kind: 'offline' };

const STORAGE_KEY = 'la-screen';
const RETRY_MS = 5_000;

interface Session {
  screenId: string;
  displayToken: string;
}

function savedSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

/**
 * The laptop's side of a screen driven by a tablet through the API. Keeps the screen across reloads of the page,
 * and opens a new one (with a new code) when the API has forgotten it.
 */
export function createScreenLink(onState: (state: ScreenState) => void): DisplayLink {
  let session: Session | null = null;

  async function post(message: object): Promise<void> {
    if (!session) return;
    await fetch(`${API_URL}/api/screens/${session.screenId}/display-messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-display-token': session.displayToken },
      body: JSON.stringify(message),
    }).catch(() => undefined);
  }

  return {
    connect({ onMessage, onIdle }) {
      let source: EventSource | null = null;
      let retry: number | undefined;
      let closed = false;
      let paired = false;

      async function open(): Promise<void> {
        if (closed) return;
        session = savedSession();
        if (!session) {
          try {
            const response = await fetch(`${API_URL}/api/screens`, { method: 'POST' });
            if (!response.ok) throw new Error(String(response.status));
            const created = (await response.json()) as NewScreen;
            session = { screenId: created.screenId, displayToken: created.displayToken };
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
          } catch {
            onState({ kind: 'offline' });
            retry = window.setTimeout(() => void open(), RETRY_MS);
            return;
          }
        }
        const url = `${API_URL}/api/screens/${session.screenId}/display-events?token=${encodeURIComponent(session.displayToken)}`;
        source = new EventSource(url);
        source.onmessage = (event: MessageEvent<string>) => {
          const message = JSON.parse(event.data) as ScreenDisplayEvent | SenderMessage | ListenMessage;
          if (message.type === 'ping') return;
          if (message.type === 'code') {
            if (paired) onIdle();
            paired = false;
            onState({ kind: 'code', code: message.code });
          } else if (message.type === 'paired') {
            paired = true;
            onState({ kind: 'paired', by: message.kind, name: message.name });
            // After a (re)connection the tablet or phone resends the current frame and track.
            void post({ type: 'ready' });
          } else {
            onMessage(message);
          }
        };
        source.onerror = () => {
          // The browser reconnects by itself after a network drop. A closed stream means the API refused it
          // (the screen was forgotten, e.g. after a deploy) or is down: start again with a new screen.
          if (source?.readyState !== EventSource.CLOSED) return;
          source.close();
          sessionStorage.removeItem(STORAGE_KEY);
          if (paired) onIdle();
          paired = false;
          onState({ kind: 'offline' });
          retry = window.setTimeout(() => void open(), RETRY_MS);
        };
      }

      onState({ kind: 'starting' });
      void open();
      return () => {
        closed = true;
        window.clearTimeout(retry);
        source?.close();
      };
    },
    send(message) {
      void post(message);
    },
  };
}
