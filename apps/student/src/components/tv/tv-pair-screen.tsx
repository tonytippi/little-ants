'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { screenCodeFromScan } from '@little-ants/shared';
import { Spinner } from '@little-ants/ui/feedback';
import { ctaClass } from '@little-ants/ui/storybook';
import { TEACHER_APP_URL } from '../../lib/api';
import { useParentMe, useStaffMe } from '../../lib/hooks';
import { pairTv } from '../../lib/tv-link';
import { Notice, Vi } from '../bits';

/**
 * What a TV's QR code opens (littleantsenglish.com/tv/pair?code=…), scanned with the phone's camera. A parent is
 * paired and sent to the app; a teacher goes on to the Teacher app's pairing; anyone else signs in first.
 */
export function TvPairScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const code = screenCodeFromScan(params.get('code') ?? '');
  const parent = useParentMe();
  const staff = useStaffMe();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!code || started.current || parent.isPending || staff.isPending) return;
    started.current = true;
    if (parent.data) {
      pairTv(code)
        .then(() => router.replace('/app'))
        .catch((failure: unknown) =>
          setError(failure instanceof Error ? failure.message : 'Could not connect to the TV'),
        );
    } else if (staff.data) {
      window.location.replace(`${TEACHER_APP_URL}/screen/pair?code=${code}`);
    } else {
      router.replace(`/signin?next=${encodeURIComponent(`/tv/pair?code=${code}`)}`);
    }
  }, [code, parent.isPending, parent.data, staff.isPending, staff.data, router]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-6 px-5 text-center">
      {!code || error ? (
        <>
          <Notice tone="warn" className="w-full text-left">
            {error ?? 'This TV code is not valid. Scan the code on the TV again.'}
            <Vi>Mã TV không hợp lệ hoặc đã hết hạn. Hãy quét lại mã trên TV.</Vi>
          </Notice>
          <a href="/app" className={ctaClass}>
            Open Listening Time
          </a>
        </>
      ) : (
        <Spinner label="Connecting to the TV · Đang kết nối TV" />
      )}
    </main>
  );
}
