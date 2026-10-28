'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { EmptyState, ErrorNotice, Spinner } from '@little-ants/ui/feedback';
import { usePermissions } from '../lib/hooks';
import { useCurrentSchool } from '../lib/school';
import type { School } from '../lib/types';

/** Pages for people who run schools: HQ admins and school admins. */
export function RunsSchoolsOnly({ children }: { children: ReactNode }) {
  const { runsSchools } = usePermissions();
  if (!runsSchools)
    return (
      <EmptyState title="School admins only">
        Ask your school admin if you need access to this page.
      </EmptyState>
    );
  return <>{children}</>;
}

/** Renders the page for the current school, with loading and "no school yet" states. */
export function WithCurrentSchool({ children }: { children: (school: School) => ReactNode }) {
  const { isAdmin } = usePermissions();
  const { school, isPending, error } = useCurrentSchool();
  if (isPending) return <Spinner label="Loading schools" />;
  if (error) return <ErrorNotice error={error} />;
  if (!school)
    return (
      <EmptyState title="No school yet">
        {isAdmin ? (
          <>
            Add the first school on the{' '}
            <Link href="/schools" className="font-semibold text-leaf-700 hover:underline">
              Schools
            </Link>{' '}
            page.
          </>
        ) : (
          'You are not a school admin at an active school.'
        )}
      </EmptyState>
    );
  return <>{children(school)}</>;
}

/** Both guards together: the usual wrapper of a school page. */
export function SchoolPage({ children }: { children: (school: School) => ReactNode }) {
  return (
    <RunsSchoolsOnly>
      <WithCurrentSchool>{children}</WithCurrentSchool>
    </RunsSchoolsOnly>
  );
}
