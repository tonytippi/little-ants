import { createAuthClient } from 'better-auth/react';

/** Better Auth client pointed at the API (auth routes live under /api/auth). */
export function createStaffAuthClient(apiBaseUrl: string) {
  return createAuthClient({
    baseURL: `${apiBaseUrl.replace(/\/$/, '')}/api/auth`,
    fetchOptions: { credentials: 'include' },
  });
}

export type StaffAuthClient = ReturnType<typeof createStaffAuthClient>;

export interface StaffUser {
  id: string;
  email: string;
  name: string;
  image: string | null;
  roles: ('ADMIN' | 'AUTHOR' | 'REVIEWER' | 'TEACHER')[];
}

export function hasRole(
  user: Pick<StaffUser, 'roles'> | null | undefined,
  ...roles: StaffUser['roles']
): boolean {
  return !!user && user.roles.some((role) => role === 'ADMIN' || roles.includes(role));
}
