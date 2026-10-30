'use client';

import { useEffect, useSyncExternalStore } from 'react';
import type { PairedScreen, ScreenTeacherEvent } from '@little-ants/shared';
import { ApiError } from '@little-ants/ui/lib/api-client';
import { api, API_URL } from './api';
import { isReceiverMessage, type ReceiverMessage, type SenderMessage } from './cast-protocol';

export type ScreenLinkStatus = 'none' | 'connecting' | 'connected' | 'screen-offline';

const STORAGE_KEY = 'la-screen-pairing';

let screenId: string | null = null;
let status: ScreenLinkStatus = 'none';
let source: EventSource | null = null;
let started = false;
const stateListeners = new Set<() => void>();
const messageListeners = new Set<(message: ReceiverMessage) => void>();

function setStatus(next: ScreenLinkStatus): void {
  if (next === status) return;
  status = next;
  stateListeners.forEach((listener) => listener());
}

function forget(): void {
  source?.close();
  source = null;
  screenId = null;
  localStorage.removeItem(STORAGE_KEY);
  setStatus('none');
}

function open(id: string): void {
  source?.close();
  screenId = id;
  setStatus('connecting');
  const stream = new EventSource(`${API_URL}/api/screens/${id}/events`, { withCredentials: true });
  source = stream;
  stream.onmessage = (event: MessageEvent<string>) => {
    const message = JSON.parse(event.data) as ScreenTeacherEvent | ReceiverMessage;
    if (message.type === 'screen-online') setStatus('connected');
    else if (message.type === 'screen-offline') setStatus('screen-offline');
    else if (isReceiverMessage(message)) messageListeners.forEach((listener) => listener(message));
  };
  stream.onerror = () => {
    // Network drops reconnect by themselves. A refused stream means the screen closed or was disconnected.
    if (stream.readyState === EventSource.CLOSED && source === stream) forget();
    else if (source === stream) setStatus('connecting');
  };
}

/** Resumes the pairing kept on this device (another lesson, a reload, or a pairing made in another tab). */
function start(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) open(saved);
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    if (event.newValue) open(event.newValue);
    else if (screenId) {
      source?.close();
      source = null;
      screenId = null;
      setStatus('none');
    }
  });
}

export async function pairScreen(code: string): Promise<void> {
  const paired = await api.post<PairedScreen>('/screens/pair', { code });
  localStorage.setItem(STORAGE_KEY, paired.screenId);
  open(paired.screenId);
}

export async function disconnectScreen(): Promise<void> {
  const id = screenId;
  forget();
  if (id) await api.del(`/screens/${id}`).catch(() => undefined);
}

/**
 * Messages to the laptop go one request at a time, so they arrive in order (a Hide on TV must not be overtaken by
 * the frame before it). While a request is out, a newer stroke in progress replaces the queued one, and a whole
 * page of ink makes queued strokes in progress pointless.
 */
const outbox: SenderMessage[] = [];
let sending = false;

/** Adds a message to the queue of messages waiting to go (see `outbox`). */
export function enqueue(queue: SenderMessage[], message: SenderMessage): void {
  if (message.type === 'ink' || message.type === 'ink-live') {
    for (let i = queue.length - 1; i >= 0; i--) if (queue[i]!.type === 'ink-live') queue.splice(i, 1);
  }
  queue.push(message);
}

export function sendToScreen(message: SenderMessage): void {
  if (!screenId || status !== 'connected') return;
  enqueue(outbox, message);
  void drainOutbox();
}

async function drainOutbox(): Promise<void> {
  if (sending) return;
  sending = true;
  try {
    for (let message = outbox.shift(); message; message = outbox.shift()) {
      const id = screenId;
      if (!id) break;
      await api.post(`/screens/${id}/messages`, message).catch((error: unknown) => {
        if (error instanceof ApiError && (error.status === 403 || error.status === 404)) forget();
      });
    }
  } finally {
    outbox.length = 0;
    sending = false;
  }
}

function subscribe(listener: () => void): () => void {
  stateListeners.add(listener);
  return () => stateListeners.delete(listener);
}

/** The laptop screen this tablet drives, if any. */
export function useScreenLink(): ScreenLinkStatus {
  useEffect(start, []);
  return useSyncExternalStore(
    subscribe,
    () => status,
    () => 'none' as const,
  );
}

export function onScreenMessage(listener: (message: ReceiverMessage) => void): () => void {
  messageListeners.add(listener);
  return () => {
    messageListeners.delete(listener);
  };
}
