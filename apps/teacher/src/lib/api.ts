import { createApiClient } from '@little-ants/ui/lib/api-client';
import { createStaffAuthClient } from '@little-ants/ui/lib/auth-client';

/** Public URL of the API (set NEXT_PUBLIC_API_URL in production). */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/** The Student (Listening Time) app that parents open (set NEXT_PUBLIC_STUDENT_APP_URL in production). */
export const STUDENT_APP_URL = process.env.NEXT_PUBLIC_STUDENT_APP_URL ?? 'http://localhost:3003';

export const api = createApiClient(API_URL);
export const auth = createStaffAuthClient(API_URL);
