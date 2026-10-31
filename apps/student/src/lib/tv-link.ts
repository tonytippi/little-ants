'use client';

/**
 * The parent's phone driving a TV screen at home (`littleantsenglish.com/tv` in the TV's browser), through the
 * API relay. One TV at a time; it is remembered on this device until the parent stops showing on the TV.
 */
import { useSyncExternalStore } from 'react';
import type { ListenFrame, PairedScreen } from '@little-ants/shared';
import { API_URL, api } from './api';

export type TvStatus = 'none' | 'connecting' | 'online' | 'offline';

/** What the TV reports about its sound (see the Teacher app's TV display). */
export interface TvAudioStatus {
  trackId: string | null;
  playing: boolean;
  current: number;
  duration: number;
  blocked?: boolean;
}

export type TvMessage =
  | { type: 'listen'; frame: ListenFrame }
  | { type: 'end' }
  | { type: 'audio'; action: 'load'; track: { id: string; url: string } | null }
  | { type: 'audio'; action: 'play' | 'pause' }
  | { type: 'audio'; action: 'seek'; time: number };

type TvEvent =
  | { type: 'screen-online' | 'screen-offline' | 'ping' | 'ready' }
  | ({ type: 'audio-status' } & TvAudioStatus);

const STORAGE_KEY = 'la-tv-screen';

let screenId: string | null = null;
let status: TvStatus = 'none';
let source: EventSource | null = null;
const statusListeners = new Set<() => void>();
const audioListeners = new Set<(status: TvAudioStatus) => void>();
const readyListeners = new Set<() => void>();

function setStatus(next: TvStatus): void {
  if (status === next) return;
  status = next;
  statusListeners.forEach((listener) => listener());
}

function remembered(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function remember(id: string | null): void {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode */
  }
}

function forget(): void {
  source?.close();
  source = null;
  screenId = null;
  outbox.length = 0;
  remember(null);
  setStatus('none');
}

function listen(id: string): void {
  source?.close();
  screenId = id;
  setStatus('connecting');
  const stream = new EventSource(`${API_URL}/api/screens/parent/${id}/events`, { withCredentials: true });
  source = stream;
  stream.onmessage = (event: MessageEvent<string>) => {
    const message = JSON.parse(event.data) as TvEvent;
    if (message.type === 'screen-online') setStatus('online');
    else if (message.type === 'screen-offline') setStatus('offline');
    else if (message.type === 'ready') readyListeners.forEach((listener) => listener());
    else if (message.type === 'audio-status') audioListeners.forEach((listener) => listener(message));
  };
  stream.onerror = () => {
    // A network drop reconnects by itself, and the API then says again whether the TV is there; a closed stream
    // means the API forgot the screen (deploy, idle TV) or it is now someone else's.
    if (stream.readyState === EventSource.CLOSED && source === stream) forget();
  };
}

/** Pairs the TV whose code was scanned or typed. Throws with a message the parent can read. */
export async function pairTv(code: string): Promise<void> {
  const paired = await api.post<PairedScreen>('/screens/parent/pair', { code });
  remember(paired.screenId);
  listen(paired.screenId);
}

/** Stops showing on the TV (the TV clears the slide and shows a new code). */
export async function stopTv(): Promise<void> {
  const id = screenId;
  forget();
  if (id) await api.del(`/screens/parent/${id}`).catch(() => undefined);
}

/** Reconnects to the TV remembered on this device (after the app was closed or reloaded). */
export function resumeTv(): void {
  if (screenId || typeof window === 'undefined') return;
  const id = remembered();
  if (id) listen(id);
}

// Messages go one at a time and in order (load before play); a newer slide replaces one still waiting.
const outbox: TvMessage[] = [];
let sending = false;

export function send(message: TvMessage): void {
  if (!screenId) return;
  const waiting = message.type === 'listen' ? outbox.findIndex((item) => item.type === 'listen') : -1;
  if (waiting >= 0) outbox[waiting] = message;
  else outbox.push(message);
  void drain();
}

async function drain(): Promise<void> {
  if (sending) return;
  sending = true;
  try {
    for (let message = outbox.shift(); message && screenId; message = outbox.shift()) {
      await fetch(`${API_URL}/api/screens/parent/${screenId}/messages`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      }).catch(() => undefined);
    }
  } finally {
    sending = false;
  }
}

export function onTvAudio(listener: (status: TvAudioStatus) => void): () => void {
  audioListeners.add(listener);
  return () => audioListeners.delete(listener);
}

/** The TV (re)connected and asks for the current slide and sound. */
export function onTvReady(listener: () => void): () => void {
  readyListeners.add(listener);
  return () => readyListeners.delete(listener);
}

function subscribe(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

export function useTvStatus(): TvStatus {
  return useSyncExternalStore(
    subscribe,
    () => status,
    () => 'none',
  );
}
