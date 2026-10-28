'use client';

import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { ApiError } from '@little-ants/ui/lib/api-client';
import { hasRole, runsSchools } from '@little-ants/ui/lib/auth-client';
import { useMe } from './session';

/** Roles helpers for the signed-in user. */
export function usePermissions() {
  const { user } = useMe();
  return {
    canEdit: hasRole(user, 'AUTHOR', 'REVIEWER'),
    canReview: hasRole(user, 'REVIEWER'),
    /** HQ admin. */
    isAdmin: hasRole(user),
    /** Any Little Ants HQ role: content pages. */
    hasHqRole: user.roles.length > 0,
    /** HQ admin or school admin: classes and school staff. */
    runsSchools: runsSchools(user),
  };
}

/** A mutation that refreshes the given queries when it succeeds. */
export function useApiMutation<TVars, TResult>(
  fn: (vars: TVars) => Promise<TResult>,
  invalidate: QueryKey[] = [],
) {
  const queryClient = useQueryClient();
  return useMutation<TResult, Error, TVars>({
    mutationFn: fn,
    onSuccess: async () => {
      await Promise.all(invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    },
  });
}

/** Field messages from a 400 response, keyed by field path. */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || !error.body.issues) return {};
  return Object.fromEntries(error.body.issues.map((issue) => [issue.path, issue.message]));
}

export function formatDate(value: string | null | undefined, withTime = false): string {
  if (!value) return '—';
  const date = new Date(value);
  return withTime
    ? date.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** A date-only value (stored as midnight UTC), shown as that calendar day everywhere. */
export function formatDay(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** "MOVE_AND_DO" → "Move and do" */
export function humanize(value: string): string {
  const text = value.toLowerCase().replaceAll('_', ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
