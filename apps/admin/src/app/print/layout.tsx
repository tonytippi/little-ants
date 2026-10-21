'use client';

import { Suspense, type ReactNode } from 'react';
import { Spinner } from '@little-ants/ui/feedback';
import { RequireStaff } from '../../lib/session';

/** Print pages: signed in, but without the app chrome. */
export default function PrintLayout({ children }: { children: ReactNode }) {
  return (
    <RequireStaff appName="Admin">
      <Suspense fallback={<Spinner />}>
        <div className="min-h-screen bg-white text-[11pt] text-black">{children}</div>
      </Suspense>
    </RequireStaff>
  );
}
