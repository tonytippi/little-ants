'use client';

import { useEffect, useRef, useState } from 'react';
import { screenCodeFromScan } from '@little-ants/shared';
import { Button } from '@little-ants/ui/button';
import { pairTv } from '../../lib/tv-link';
import { Vi } from '../bits';

/** Chrome's barcode reader (not in TypeScript's DOM types yet). */
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
type BarcodeDetectorClass = new (options: { formats: string[] }) => BarcodeDetectorLike;

/** Reads QR codes from the camera: Chrome's built-in reader, or jsQR where there is none (iPhone and iPad). */
async function qrReader(): Promise<(video: HTMLVideoElement) => Promise<string[]>> {
  const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorClass }).BarcodeDetector;
  if (Detector) {
    const detector = new Detector({ formats: ['qr_code'] });
    return async (video) => (await detector.detect(video)).map((code) => code.rawValue);
  }
  const { default: jsQR } = await import('jsqr');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  return async (video) => {
    if (!context || !video.videoWidth) return [];
    // A smaller copy is plenty for a code filling part of the picture, and much faster to read.
    const scale = Math.min(1, 640 / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const found = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' });
    return found ? [found.data] : [];
  };
}

/**
 * Watch on TV: scan the code the TV shows (littleantsenglish.com → Watch on TV), or type it.
 * Mount it only while open, so every opening starts fresh.
 */
export function TvScanner({ onClose, onPaired }: { onClose: () => void; onPaired: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The dialog mounts only on the device (opened by a tap), so navigator is there.
  const [noCamera, setNoCamera] = useState(() => !navigator.mediaDevices?.getUserMedia);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  async function pair(code: string): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await pairTv(code);
      onPaired();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not connect to the TV');
    } finally {
      setBusy(false);
    }
  }
  const pairRef = useRef(pair);
  useEffect(() => {
    pairRef.current = pair;
  });

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) return;
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    let stopped = false;
    let found = false;
    void (async () => {
      try {
        const read = await qrReader();
        const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
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
          void read(element).then((texts) => {
            const code = texts.map((text) => screenCodeFromScan(text)).find(Boolean);
            if (code && !found) {
              found = true;
              void pairRef.current(code).finally(() => {
                found = false;
              });
            }
          });
        }, 300);
      } catch {
        setNoCamera(true);
      }
    })();
    return () => {
      stopped = true;
      window.clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const typedCode = screenCodeFromScan(typed);

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-3xl bg-cream-50 p-0 text-bark-900 shadow-xl backdrop:bg-bark-900/40"
    >
      <form
        method="dialog"
        className="flex flex-col gap-4 p-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (typedCode) void pair(typedCode);
        }}
      >
        <h2 className="font-display text-2xl font-extrabold text-ant-500">
          Watch on TV
          <Vi className="not-italic">Xem trên TV</Vi>
        </h2>
        <p className="text-sm text-bark-500">
          On the TV, open the web browser and go to <strong>littleantsenglish.com</strong>, press Watch on TV,
          then point the camera at the code.
          <Vi>
            Trên TV, mở trình duyệt, vào littleantsenglish.com, bấm Xem trên TV rồi quét mã trên màn hình.
          </Vi>
        </p>
        {noCamera ? (
          <p className="rounded-2xl bg-cream-100 p-3 text-sm text-bark-700">
            The camera is not available. Type the code shown on the TV.
            <Vi>Không mở được camera. Hãy nhập mã trên TV.</Vi>
          </p>
        ) : (
          <video
            ref={video}
            muted
            playsInline
            className="aspect-square w-full rounded-2xl bg-bark-900 object-cover"
          />
        )}
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Or type the code · Hoặc nhập mã
          <input
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="ABC234"
            className="rounded-xl border border-cream-200 bg-white px-3 py-2 font-mono text-2xl tracking-[0.2em] uppercase"
          />
        </label>
        {error ? <p className="text-sm font-semibold text-ant-700">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => dialog.current?.close()}>
            Close · Đóng
          </Button>
          <Button type="submit" disabled={!typedCode || busy}>
            Connect · Kết nối
          </Button>
        </div>
      </form>
    </dialog>
  );
}
