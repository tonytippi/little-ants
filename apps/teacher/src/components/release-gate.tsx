'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import type { UnitReleasePayload } from '@little-ants/shared';
import { buttonClass } from '@little-ants/ui/button';
import { ErrorNotice, Spinner } from '@little-ants/ui/feedback';
import { ApiError } from '@little-ants/ui/lib/api-client';
import { useRelease } from '../lib/queries';

/** Loads a unit release (downloaded copy first) and shows clear messages when it is not available. */
export function ReleaseGate({
  unit,
  preview = false,
  children,
}: {
  unit: string | null;
  preview?: boolean;
  children: (payload: UnitReleasePayload, offline: boolean) => ReactNode;
}) {
  const release = useRelease(unit, { preview });
  if (!unit) return <Message text="No unit was chosen." />;
  if (release.isPending) return <Spinner label={`Opening ${unit}`} />;
  if (release.error) {
    const notFound = release.error instanceof ApiError && release.error.status === 404;
    const offline = !(release.error instanceof ApiError);
    return (
      <Message
        text={
          notFound
            ? `${unit} has not been published yet.`
            : offline
              ? `${unit} is not downloaded on this device and there is no internet. Download units before class.`
              : undefined
        }
        error={notFound || offline ? undefined : release.error}
      />
    );
  }
  return <>{children(release.data.payload, release.data.offline)}</>;
}

function Message({ text, error }: { text?: string; error?: unknown }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-start gap-4 p-8">
      {text ? <p className="text-lg font-semibold text-bark-900">{text}</p> : null}
      {error ? <ErrorNotice error={error} /> : null}
      <Link href="/" className={buttonClass('secondary')}>
        Back to today
      </Link>
    </div>
  );
}
