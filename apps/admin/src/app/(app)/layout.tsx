'use client';

import { Suspense, type ReactNode } from 'react';
import { Spinner } from '@little-ants/ui/feedback';
import { AppShell } from '../../components/app-shell';
import { SchoolProvider } from '../../lib/school';
import { RequireStaff } from '../../lib/session';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <RequireStaff appName="Admin">
      <SchoolProvider>
        <AppShell>
          <Suspense fallback={<Spinner />}>{children}</Suspense>
        </AppShell>
      </SchoolProvider>
    </RequireStaff>
  );
}
