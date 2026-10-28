'use client';

import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useState, type ReactNode } from 'react';
import { runsSchools } from '@little-ants/ui/lib/auth-client';
import { api } from './api';
import { useMe } from './session';
import type { School } from './types';

const STORAGE_KEY = 'little-ants.admin.school';

export const SCHOOLS_KEY = ['schools'];

interface CurrentSchool {
  /** Schools the signed-in person may run: every school for HQ admins, else where they are school admin. */
  schools: School[];
  /** The school the org pages work on, or null when there is none to run. */
  school: School | null;
  setSchoolId: (id: string) => void;
  isPending: boolean;
  error: Error | null;
}

const SchoolContext = createContext<CurrentSchool | null>(null);

function storedSchoolId(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private mode, blocked cookies); the first school is used instead.
    return null;
  }
}

/** Keeps the chosen school (remembered on this device) for people who run schools. */
export function SchoolProvider({ children }: { children: ReactNode }) {
  const { user } = useMe();
  const enabled = runsSchools(user);
  const query = useQuery({
    queryKey: SCHOOLS_KEY,
    queryFn: () => api.get<School[]>('/schools'),
    enabled,
  });
  const [chosenId, setChosenId] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : storedSchoolId(),
  );

  const schools = (query.data ?? []).filter((school) => school.myRole === 'SCHOOL_ADMIN');
  const school =
    schools.find((item) => item.id === chosenId) ?? schools.find((item) => item.active) ?? schools[0] ?? null;

  const setSchoolId = (id: string): void => {
    setChosenId(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Not remembered on this device; the choice still applies until the page reloads.
    }
  };

  const value: CurrentSchool = {
    schools,
    school,
    setSchoolId,
    isPending: enabled && query.isPending,
    error: query.error,
  };
  return <SchoolContext.Provider value={value}>{children}</SchoolContext.Provider>;
}

/** The school the classes and school staff pages work on. Only use inside <SchoolProvider>. */
export function useCurrentSchool(): CurrentSchool {
  const value = useContext(SchoolContext);
  if (!value) throw new Error('useCurrentSchool must be used inside SchoolProvider');
  return value;
}
