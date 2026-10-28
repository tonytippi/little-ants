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
  /** Little Ants HQ roles. */
  roles: ('ADMIN' | 'AUTHOR' | 'REVIEWER')[];
  /** Schools the person works at, with their role there. */
  schools: { schoolId: string; role: 'SCHOOL_ADMIN' | 'TEACHER' }[];
}

/** HQ admins and school admins: may run schools (HQ admins every school). */
export function runsSchools(user: Pick<StaffUser, 'roles' | 'schools'> | null | undefined): boolean {
  return (
    !!user && (user.roles.includes('ADMIN') || user.schools.some((school) => school.role === 'SCHOOL_ADMIN'))
  );
}

export function hasRole(
  user: Pick<StaffUser, 'roles'> | null | undefined,
  ...roles: StaffUser['roles']
): boolean {
  return !!user && user.roles.some((role) => role === 'ADMIN' || roles.includes(role));
}
