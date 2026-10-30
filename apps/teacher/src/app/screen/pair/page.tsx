'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { normalizeScreenCode } from '@little-ants/shared';
import { buttonClass } from '@little-ants/ui/button';
import { Spinner } from '@little-ants/ui/feedback';
import { pairScreen } from '../../../lib/screen-link';
import { RequireStaff } from '../../../lib/session';

type Result = { kind: 'pairing' } | { kind: 'done' } | { kind: 'error'; message: string };

/**
 * Opened when the laptop's QR code is scanned with the camera app instead of the Teacher app. Pairs the screen
 * with this device; the lesson already open in another tab picks the pairing up.
 */
function Pair() {
  const code = normalizeScreenCode(useSearchParams().get('code') ?? '');
  const [result, setResult] = useState<Result>(() =>
    code ? { kind: 'pairing' } : { kind: 'error', message: 'This link has no valid code.' },
  );

  useEffect(() => {
    if (!code) return;
    pairScreen(code).then(
      () => setResult({ kind: 'done' }),
      (error: unknown) =>
        setResult({ kind: 'error', message: error instanceof Error ? error.message : 'Could not connect.' }),
    );
  }, [code]);

  if (result.kind === 'pairing') return <Spinner label="Connecting to the TV screen" />;
  return (
    <main className="mx-auto flex max-w-lg flex-col items-start gap-4 p-8">
      <h1 className="text-2xl font-extrabold text-bark-900">
        {result.kind === 'done' ? 'The TV screen is connected' : 'Not connected'}
      </h1>
      <p className="text-bark-700">
        {result.kind === 'done'
          ? 'Go back to your lesson (or open one): the TV now follows it.'
          : result.message}
      </p>
      <Link href="/" className={buttonClass('primary')}>
        Today
      </Link>
    </main>
  );
}

export default function ScreenPairPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <RequireStaff appName="Teacher">
        <Pair />
      </RequireStaff>
    </Suspense>
  );
}
