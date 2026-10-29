'use client';

import { useCallback, useSyncExternalStore } from 'react';

/** Text sizes for the teacher notes, smallest first. */
export const NOTE_SIZES = ['text-[15px]', 'text-[17px]', 'text-[20px]', 'text-[24px]'] as const;

const KEY = 'la-note-size';
const listeners = new Set<() => void>();

export function clampNoteSize(value: number): number {
  return Number.isInteger(value) ? Math.min(Math.max(0, value), NOTE_SIZES.length - 1) : 0;
}

function read(): number {
  try {
    return clampNoteSize(Number(localStorage.getItem(KEY) ?? '0'));
  } catch {
    return 0;
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The chosen note size (an index into NOTE_SIZES), remembered on this device. */
export function useNoteSize(): [number, (size: number) => void] {
  const size = useSyncExternalStore(subscribe, read, () => 0);
  const setSize = useCallback((next: number) => {
    try {
      localStorage.setItem(KEY, String(clampNoteSize(next)));
    } catch {
      // Private mode or full storage: the size just is not remembered.
    }
    listeners.forEach((listener) => listener());
  }, []);
  return [size, setSize];
}
