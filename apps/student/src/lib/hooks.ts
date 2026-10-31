'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ListeningSummary } from '@little-ants/shared';
import { ApiError } from '@little-ants/ui/lib/api-client';
import { SIGNED_IN_KEY } from '../components/landing/landing-script';
import { api } from './api';
import { clearFamilyData, kvGet, kvSet } from './local-db';
import { isOffline, loadUnit, type PayloadSource } from './media-cache';
import { allClassRuns, allLogs, flushOutbox, subscribeOutbox, type OutboxState } from './outbox';
import { localDay } from './progress';
import type { ParentDevice, ParentMe, SchoolClass, StaffMe } from './types';

/** An API answer, kept on the device so the app also opens offline. 401 is never answered from the copy. */
async function cached<T extends object>(
  key: string,
  load: () => Promise<T>,
): Promise<T & { offline?: boolean }> {
  try {
    const value = await load();
    await kvSet(key, value);
    return value as T & { offline?: boolean };
  } catch (error) {
    if (isOffline(error)) {
      const copy = await kvGet<T>(key);
      if (copy !== undefined && copy !== null) return { ...copy, offline: true };
    }
    throw error;
  }
}

const notSignedIn = (error: unknown): boolean => error instanceof ApiError && error.isUnauthorized;
const retryUnlessSignedOut = (count: number, error: unknown): boolean => !notSignedIn(error) && count < 1;

/** The signed-in parent and their children (401 = not signed in as a parent). */
export function useParentMe() {
  return useQuery({
    queryKey: ['parent-me'],
    queryFn: () => cached<ParentMe>('parent-me', () => api.get<ParentMe>('/parent/me')),
    retry: retryUnlessSignedOut,
  });
}

/** The signed-in staff user (shared Little Ants staff session), or null when not staff. */
export function useStaffMe() {
  return useQuery({
    queryKey: ['staff-me'],
    queryFn: async (): Promise<StaffMe | null> => {
      try {
        return await cached<StaffMe>('staff-me', () => api.get<StaffMe>('/me'));
      } catch (error) {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          await kvSet('staff-me', null);
          return null;
        }
        if (isOffline(error)) return null;
        throw error;
      }
    },
    retry: false,
  });
}

/** Classes the staff user teaches (At school). */
export function useSchoolClasses(enabled: boolean) {
  return useQuery({
    queryKey: ['school-classes'],
    queryFn: async () =>
      (
        await cached('school-classes', async () => ({
          classes: await api.get<SchoolClass[]>('/teach/classes'),
        }))
      ).classes,
    enabled,
  });
}

/** A unit's leaves for a child or a class (offline: the copy on the device). */
export function useUnit(source: PayloadSource | null) {
  return useQuery({
    queryKey: ['unit', source],
    queryFn: () => loadUnit(source!),
    enabled: !!source,
    retry: (count, error) => isOffline(error) && count < 1,
  });
}

/** A child's progress in a unit from the server (offline: the last copy). */
export function useSummary(studentId: string | null, unitCode: string | null) {
  const today = useToday();
  return useQuery({
    queryKey: ['summary', studentId, unitCode, today],
    queryFn: () =>
      cached<ListeningSummary>(`summary:${studentId}:${unitCode}`, () =>
        api.get<ListeningSummary>(
          `/parent/students/${studentId}/listening/summary?unit=${unitCode}&today=${today}`,
        ),
      ),
    enabled: !!studentId && !!unitCode,
    retry: retryUnlessSignedOut,
  });
}

export function useOutboxState(): OutboxState {
  const [state, setState] = useState<OutboxState>({ pending: 0, rejected: 0, syncing: false, version: 0 });
  useEffect(() => subscribeOutbox(setState), []);
  return state;
}

/** Leaves finished on this device (re-read whenever the outbox changes). */
export function useLocalLogs() {
  const { version } = useOutboxState();
  return useQuery({
    queryKey: ['local-logs', version],
    queryFn: allLogs,
    placeholderData: (previous) => previous,
  });
}

/** Leaves played in class on this device. */
export function useClassRuns() {
  const { version } = useOutboxState();
  return useQuery({
    queryKey: ['class-runs', version],
    queryFn: allClassRuns,
    placeholderData: (previous) => previous,
  });
}

/** Refresh the server summary after uploads finish, so it includes what was just sent. */
export function useRefreshAfterSync(): void {
  const queryClient = useQueryClient();
  const { syncing, pending } = useOutboxState();
  const before = useRef(pending);
  useEffect(() => {
    if (!syncing && pending < before.current) void queryClient.invalidateQueries({ queryKey: ['summary'] });
    before.current = pending;
  }, [syncing, pending, queryClient]);
}

function subscribeOnline(listener: () => void): () => void {
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  return () => {
    window.removeEventListener('online', listener);
    window.removeEventListener('offline', listener);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

/** Today's local date, updated when the day changes while the app is open. */
export function useToday(): string {
  const [today, setToday] = useState(localDay);
  useEffect(() => {
    const timer = setInterval(() => setToday(localDay()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return today;
}

const remembered = new Map<string, string | null>();
const rememberedListeners = new Set<() => void>();

function readRemembered(key: string): string | null {
  if (remembered.has(key)) return remembered.get(key) ?? null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // storage blocked
  }
}

function subscribeRemembered(listener: () => void): () => void {
  rememberedListeners.add(listener);
  return () => rememberedListeners.delete(listener);
}

/** Remember a choice on this device (child, class, mode); kept in memory when storage is blocked. */
export function remember(key: string, value: string | null): void {
  remembered.set(key, value);
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage blocked: the in-memory value is used */
  }
  rememberedListeners.forEach((listener) => listener());
}

/** A choice remembered on this device. */
export function useRemembered<T extends string>(key: string): [T | null, (value: T | null) => void] {
  const value = useSyncExternalStore(
    subscribeRemembered,
    () => readRemembered(key),
    () => null,
  ) as T | null;
  return [value, (next) => remember(key, next)];
}

export function useDevices(enabled: boolean) {
  return useQuery({
    queryKey: ['devices'],
    queryFn: () => api.get<ParentDevice[]>('/parent/devices'),
    enabled,
  });
}

/**
 * Sign the parent out on this device. Leaves not uploaded yet are tried once more; if some remain, the parent
 * confirms losing them. The family's data is removed from the device (downloaded units stay).
 */
export async function signOutParent(): Promise<void> {
  await flushOutbox({ force: true });
  const waiting = (await allLogs()).filter((log) => log.status === 'pending').length;
  if (
    waiting > 0 &&
    !window.confirm(
      `${waiting} finished leaf/leaves have not been uploaded yet (no internet?). Signing out removes them from this device. Sign out anyway?\n\n` +
        `${waiting} lá chưa được gửi lên (chưa có mạng?). Đăng xuất sẽ xoá chúng khỏi máy này. Vẫn đăng xuất?`,
    )
  )
    return;
  try {
    await api.post('/parent/auth/logout');
  } catch {
    // Offline: the cookie stays until it expires, but this device forgets the family.
  }
  await clearFamilyData();
  remember('la-student-child', null);
  rememberSignedIn(false);
  window.location.replace('/signin');
}

/** Whether a parent or staff user is signed in on this device (read by the landing page before it paints). */
export function rememberSignedIn(signedIn: boolean): void {
  try {
    if (signedIn) localStorage.setItem(SIGNED_IN_KEY, '1');
    else localStorage.removeItem(SIGNED_IN_KEY);
  } catch {
    /* private mode */
  }
}
