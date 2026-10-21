'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@little-ants/ui/lib/api-client';
import type { UnitReleasePayload } from '@little-ants/shared';
import { api } from './api';
import { kvGet, kvSet, listStoredReleases } from './local-db';
import { loadRelease } from './media-cache';
import type { PublishedUnit, ServerObservation, TeachClass } from './types';

/** GET an API path, keeping the last good answer on the device for offline use. */
async function cachedGet<T>(path: string): Promise<{ data: T; stale: boolean }> {
  try {
    const data = await api.get<T>(path);
    await kvSet(`get:${path}`, data);
    return { data, stale: false };
  } catch (error) {
    if (error instanceof ApiError && error.status !== 0) throw error;
    const cached = await kvGet<T>(`get:${path}`);
    if (cached !== undefined) return { data: cached, stale: true };
    throw error;
  }
}

export function useTeachClasses() {
  return useQuery({
    queryKey: ['teach', 'classes'],
    queryFn: () => cachedGet<TeachClass[]>('/teach/classes'),
  });
}

export function usePublishedUnits() {
  return useQuery({
    queryKey: ['teach', 'units'],
    queryFn: () => cachedGet<PublishedUnit[]>('/teach/units'),
  });
}

/** Versions of the units downloaded on this device, by unit code. */
export function useDownloadedVersions() {
  return useQuery({
    queryKey: ['downloads'],
    queryFn: async () => {
      const releases = await listStoredReleases();
      return Object.fromEntries(
        releases.map((release) => [
          release.code,
          { version: release.payload.version, mediaBytes: release.mediaBytes },
        ]),
      );
    },
    staleTime: 0,
  });
}

export function useRefreshDownloads(): () => void {
  const client = useQueryClient();
  return () => void client.invalidateQueries({ queryKey: ['downloads'] });
}

/** A unit release to teach from: downloaded copy first, otherwise live; previews load the current draft. */
export function useRelease(code: string | null, options: { preview?: boolean } = {}) {
  return useQuery({
    queryKey: ['release', code, options.preview ? 'preview' : 'published'],
    enabled: !!code,
    staleTime: options.preview ? 0 : Infinity,
    queryFn: async (): Promise<{ payload: UnitReleasePayload; offline: boolean }> => {
      if (options.preview)
        return {
          payload: await api.get<UnitReleasePayload>(`/content/units/${code}/preview`),
          offline: false,
        };
      return loadRelease(code!);
    },
  });
}

export function useServerObservations(classId: string | null, unitCode: string | null) {
  return useQuery({
    queryKey: ['observations', classId, unitCode],
    enabled: !!classId && !!unitCode,
    queryFn: () => cachedGet<ServerObservation[]>(`/teach/classes/${classId}/observations?unit=${unitCode}`),
    // No point retrying while offline; the outbox refreshes this when it syncs.
    retry: (count, error) => error instanceof ApiError && error.status >= 500 && count < 2,
  });
}
