'use client';

import { useEffect, useRef, useState } from 'react';
import { screenCodeFromScan as screenCodeFrom } from '@little-ants/shared';
import { Button } from '@little-ants/ui/button';
import { pairScreen } from '../../lib/screen-link';

/** Chrome's barcode reader (not in TypeScript's DOM types yet). */
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
type BarcodeDetectorClass = new (options: { formats: string[] }) => BarcodeDetectorLike;

function canScan(): boolean {
  return (
    typeof window !== 'undefined' && 'BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia
  );
}

/**
 * Pairs this tablet with a laptop screen: scan its QR code with the camera, or type the code.
 * Mount it only while open, so every opening starts fresh.
 */
export function ScreenPairDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cameraNote, setCameraNote] = useState<string | null>(() =>
    canScan() ? null : 'This browser cannot scan codes. Type the code shown on the TV.',
  );

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  async function pair(code: string): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await pairScreen(code);
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not connect to the screen');
    } finally {
      setBusy(false);
    }
  }
  const pairRef = useRef(pair);
  useEffect(() => {
    pairRef.current = pair;
  });

  useEffect(() => {
    if (!canScan()) return;
    const Detector = (window as unknown as { BarcodeDetector: BarcodeDetectorClass }).BarcodeDetector;
    const detector = new Detector({ formats: ['qr_code'] });
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    let stopped = false;
    let found = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((media) => {
        if (stopped) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = media;
        if (video.current) {
          video.current.srcObject = media;
          void video.current.play();
        }
        timer = window.setInterval(() => {
          const element = video.current;
          if (found || !element || element.readyState < 2) return;
          void detector.detect(element).then((codes) => {
            const code = codes.map((item) => screenCodeFrom(item.rawValue)).find(Boolean);
            if (code && !found) {
              found = true;
              void pairRef.current(code).finally(() => {
                found = false;
              });
            }
          });
        }, 300);
      })
      .catch(() => setCameraNote('The camera is not allowed. Type the code shown on the TV.'));
    return () => {
      stopped = true;
      window.clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const typedCode = screenCodeFrom(typed);

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-3xl bg-white p-0 text-bark-900 shadow-xl backdrop:bg-bark-900/40"
    >
      <form
        method="dialog"
        className="flex flex-col gap-4 p-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (typedCode) void pair(typedCode);
        }}
      >
        <h2 className="text-xl font-extrabold">Connect to the TV screen</h2>
        <p className="text-sm text-bark-500">
          In the TV&apos;s web browser (or on a laptop plugged into the TV), open{' '}
          <strong>littleantsenglish.com/tv</strong>. Point the camera at the code on the TV.
        </p>
        {cameraNote ? (
          <p className="rounded-2xl bg-cream-100 p-3 text-sm text-bark-700">{cameraNote}</p>
        ) : (
          <video
            ref={video}
            muted
            playsInline
            className="aspect-square w-full rounded-2xl bg-bark-900 object-cover"
          />
        )}
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Or type the code
          <input
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="ABC234"
            className="rounded-xl border border-cream-200 px-3 py-2 font-mono text-2xl uppercase tracking-[0.2em]"
          />
        </label>
        {error ? <p className="text-sm font-semibold text-ant-700">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!typedCode} busy={busy}>
            Connect
          </Button>
        </div>
      </form>
    </dialog>
  );
}
