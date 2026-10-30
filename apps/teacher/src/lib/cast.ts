'use client';

import { useEffect, useSyncExternalStore } from 'react';
import {
  CAST_APP_ID,
  CAST_NAMESPACE,
  isReceiverMessage,
  type ReceiverMessage,
  type SenderMessage,
} from './cast-protocol';

/** The parts of the Cast Web Sender SDK this app uses (loaded from gstatic, so no npm types). */
interface CastSession {
  getCastDevice(): { friendlyName: string };
  sendMessage(namespace: string, message: SenderMessage): Promise<unknown>;
  addMessageListener(namespace: string, listener: (namespace: string, message: string) => void): void;
}

interface CastContext {
  setOptions(options: { receiverApplicationId: string; autoJoinPolicy: string }): void;
  addEventListener(type: string, listener: (event: { castState?: string }) => void): void;
  getCastState(): string;
  getCurrentSession(): CastSession | null;
  requestSession(): Promise<unknown>;
  endCurrentSession(stopCasting: boolean): void;
}

interface SenderSdk {
  cast: {
    framework: {
      CastContext: { getInstance(): CastContext };
      CastContextEventType: { CAST_STATE_CHANGED: string; SESSION_STATE_CHANGED: string };
    };
  };
  chrome: { cast: { AutoJoinPolicy: { ORIGIN_SCOPED: string } } };
}

const SENDER_SDK = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';

export type CastStatus = 'unavailable' | 'no-devices' | 'ready' | 'connecting' | 'connected';

export interface CastState {
  status: CastStatus;
  /** Name of the TV while connected. */
  device: string | null;
}

let state: CastState = { status: 'unavailable', device: null };
let context: CastContext | null = null;
let listenedSession: CastSession | null = null;
let loading = false;
const stateListeners = new Set<() => void>();
const messageListeners = new Set<(message: ReceiverMessage) => void>();

const STATUS: Record<string, CastStatus> = {
  NO_DEVICES_AVAILABLE: 'no-devices',
  NOT_CONNECTED: 'ready',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
};

/**
 * The SDK's cast state as last reported in a CAST_STATE_CHANGED event. Asking `getCastState()` while the SDK is
 * dispatching its events can still return the old state (e.g. CONNECTED right after the session ended).
 */
let castState = 'NO_DEVICES_AVAILABLE';

function refresh(): void {
  if (!context) return;
  const status = STATUS[castState] ?? 'unavailable';
  const session = status === 'connected' ? context.getCurrentSession() : null;
  if (session && session !== listenedSession) {
    listenedSession = session;
    session.addMessageListener(CAST_NAMESPACE, (_namespace, raw) => {
      let message: unknown;
      try {
        message = JSON.parse(raw);
      } catch {
        return;
      }
      if (isReceiverMessage(message)) messageListeners.forEach((listener) => listener(message));
    });
  }
  const device = status === 'connected' && session ? session.getCastDevice().friendlyName : null;
  if (status === state.status && device === state.device) return;
  state = { status, device };
  stateListeners.forEach((listener) => listener());
}

/** Loads the sender SDK once. Browsers without Cast (Firefox, Safari) stay 'unavailable'. */
function load(): void {
  if (loading || typeof window === 'undefined') return;
  loading = true;
  const win = window as unknown as SenderSdk & { __onGCastApiAvailable?: (available: boolean) => void };
  win.__onGCastApiAvailable = (available) => {
    if (!available) return;
    const { CastContext, CastContextEventType } = win.cast.framework;
    context = CastContext.getInstance();
    // Re-join the running TV session when the teacher opens another lesson in this app.
    context.setOptions({
      receiverApplicationId: CAST_APP_ID,
      autoJoinPolicy: win.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
    });
    context.addEventListener(CastContextEventType.CAST_STATE_CHANGED, (event) => {
      if (event.castState) castState = event.castState;
      refresh();
    });
    context.addEventListener(CastContextEventType.SESSION_STATE_CHANGED, () => refresh());
    castState = context.getCastState();
    refresh();
  };
  const script = document.createElement('script');
  script.src = SENDER_SDK;
  script.async = true;
  document.head.appendChild(script);
}

function subscribe(listener: () => void): () => void {
  stateListeners.add(listener);
  return () => stateListeners.delete(listener);
}

const serverState: CastState = { status: 'unavailable', device: null };

/** Google Cast state for the TV menu; loads the SDK on first use. */
export function useCast(): CastState {
  useEffect(load, []);
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => serverState,
  );
}

/** Calls `listener` for every message from the Cast receiver; returns the unsubscribe. */
export function onCastMessage(listener: (message: ReceiverMessage) => void): () => void {
  messageListeners.add(listener);
  return () => {
    messageListeners.delete(listener);
  };
}

/** Opens Chrome's device picker. Resolves when connected; rejects if the teacher closes the picker. */
export async function startCasting(): Promise<void> {
  await context?.requestSession();
  refresh();
}

/** Ends the session; the TV goes back to its home screen. */
export function stopCasting(): void {
  if (!context) return;
  context.endCurrentSession(true);
  // Show it as stopped at once; the SDK's own state change follows.
  castState = 'NOT_CONNECTED';
  refresh();
}

export function sendToCast(message: SenderMessage): void {
  if (state.status !== 'connected') return;
  context
    ?.getCurrentSession()
    ?.sendMessage(CAST_NAMESPACE, message)
    .catch(() => undefined);
}
