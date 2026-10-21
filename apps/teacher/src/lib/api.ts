import { createApiClient } from '@little-ants/ui/lib/api-client';
import { createStaffAuthClient } from '@little-ants/ui/lib/auth-client';

/** Public URL of the API (set NEXT_PUBLIC_API_URL in production). */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export const api = createApiClient(API_URL);
export const auth = createStaffAuthClient(API_URL);
