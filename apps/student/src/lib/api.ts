import { createApiClient } from '@little-ants/ui/lib/api-client';

/** Public URL of the API (set NEXT_PUBLIC_API_URL in production). */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/** The Teacher app, where staff sign in before using At school here. */
export const TEACHER_APP_URL = process.env.NEXT_PUBLIC_TEACHER_APP_URL ?? 'http://localhost:3002';

/** JSON client that sends the parent cookie (and the shared staff session cookie) on every request. */
export const api = createApiClient(API_URL);

/** Where the browser goes to sign a parent in with Google; the API sends it back to `returnPath`. */
export function parentSignInUrl(returnPath = '/app', hint?: string): string {
  const url = new URL(`${api.baseUrl}/api/parent/auth/google/start`);
  url.searchParams.set('return', returnPath.startsWith('/') ? returnPath : '/app');
  if (hint) url.searchParams.set('hint', hint);
  return url.toString();
}
