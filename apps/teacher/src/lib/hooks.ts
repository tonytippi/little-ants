'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { subscribeOutbox, type OutboxState } from './outbox';

function subscribeOnline(callback: () => void): () => void {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

/** Whether the browser thinks it is online. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

export function useOutboxState(): OutboxState {
  const [state, setState] = useState<OutboxState>({
    pending: 0,
    failed: 0,
    syncing: false,
    needsSignIn: false,
    lastError: null,
  });
  useEffect(() => subscribeOutbox(setState), []);
  return state;
}

/** Seconds since `start` (ms timestamp), updated every second while `running`. */
export function useElapsedSeconds(start: number, running: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running, start]);
  return Math.max(0, Math.floor((now - start) / 1000));
}
