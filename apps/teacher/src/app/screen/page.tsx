'use client';

import QRCode from 'qrcode';
import { useEffect, useMemo, useState } from 'react';
import { TvDisplay } from '../../components/tv-display';
import { screenPairUrl } from '@little-ants/shared';
import { STUDENT_APP_URL } from '../../lib/api';
import { createScreenLink, type ScreenState } from '../../lib/screen-display';

/**
 * A TV's own web browser, or a laptop plugged into the TV (display mode Duplicate). No sign-in: it shows a code
 * until a teacher's tablet (a lesson) or a parent's phone (Listening Time at home) pairs, then shows what that
 * device sends and plays its audio.
 */
export default function ScreenPage() {
  const [state, setState] = useState<ScreenState>({ kind: 'starting' });
  const [started, setStarted] = useState(false);
  const link = useMemo(() => createScreenLink(setState), []);

  // Keep the laptop from sleeping in the middle of a lesson.
  useEffect(() => {
    if (!started || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const acquire = (): void => {
      if (document.visibilityState !== 'visible') return;
      navigator.wakeLock
        .request('screen')
        .then((sentinel) => {
          lock = sentinel;
        })
        .catch(() => undefined);
    };
    acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      document.removeEventListener('visibilitychange', acquire);
      void lock?.release();
    };
  }, [started]);

  function start(): void {
    // This tap also lets the page play sound later (browsers block audio until the page is touched).
    setStarted(true);
    void document.documentElement.requestFullscreen?.().catch(() => undefined);
  }

  return (
    <div>
      <TvDisplay link={link} waiting={<Waiting state={state} />} />
      {started ? null : (
        <button
          type="button"
          onClick={start}
          className="fixed right-4 top-4 z-10 rounded-2xl bg-leaf-600 px-5 py-3 text-lg font-bold text-white shadow-lg hover:bg-leaf-700"
        >
          Start: full screen and sound on
        </button>
      )}
    </div>
  );
}

function Waiting({ state }: { state: ScreenState }) {
  const [qr, setQr] = useState<string | null>(null);
  const code = state.kind === 'code' ? state.code : null;

  useEffect(() => {
    if (!code) return;
    // One address for everyone: the Student app sends teachers on to the Teacher app's pairing page.
    const url = screenPairUrl(STUDENT_APP_URL, code);
    void QRCode.toDataURL(url, { margin: 1, width: 480, color: { dark: '#4a2e20', light: '#ffffff' } }).then(
      setQr,
    );
  }, [code]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-8 text-center">
      {state.kind === 'code' ? (
        <>
          <p className="font-display text-[clamp(2rem,4vw,3.5rem)] font-extrabold leading-tight text-bark-900">
            Scan with the Little Ants app
          </p>
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qr} alt={`Pairing code ${state.code}`} className="size-[min(45vh,28rem)] rounded-3xl" />
          ) : null}
          <p className="font-mono text-[clamp(2.5rem,6vw,5rem)] font-bold tracking-[0.3em] text-ant-600">
            {state.code}
          </p>
          <p className="max-w-3xl text-xl text-bark-500">
            Parents: Listening Time → Watch on TV. Teachers: in a lesson, Show on TV → TV browser or laptop.
            <span lang="vi" className="mt-1 block">
              Phụ huynh: mở Listening Time → Xem trên TV, rồi quét mã này.
            </span>
          </p>
        </>
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className="size-40" />
          <p className="font-display text-[clamp(3rem,6vw,5rem)] font-extrabold leading-none text-ant-500">
            Little Ants English
          </p>
          <p className="text-2xl text-bark-500">
            {state.kind === 'paired'
              ? state.by === 'parent'
                ? 'Connected to a phone. Choose a leaf on the phone. · Đã kết nối. Chọn một chiếc lá trên điện thoại.'
                : `Connected to ${state.name}. Open a lesson on the tablet.`
              : state.kind === 'offline'
                ? 'No connection to Little Ants. Check the internet; trying again…'
                : 'Starting…'}
          </p>
        </>
      )}
    </div>
  );
}
