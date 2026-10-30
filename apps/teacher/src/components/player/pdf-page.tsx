'use client';

import { useEffect, useRef, useState } from 'react';
import { loadLegacyPdf, needsLegacyPdf } from '../../lib/pdf-legacy';

/** One PDF page, drawn the same way whichever pdf.js opened it. */
interface ShownPage {
  width: number;
  height: number;
  draw(canvas: HTMLCanvasElement, scale: number): { promise: Promise<void>; cancel(): void };
}
interface ShownPdf {
  numPages: number;
  page(number: number): Promise<ShownPage>;
}

const documents = new Map<string, Promise<ShownPdf>>();

async function openModern(url: string): Promise<ShownPdf> {
  const pdfjs = await import('pdfjs-dist');
  // Served from our own origin (copied at build time) so it is cached for offline use.
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  const doc = await pdfjs.getDocument({ url }).promise;
  return {
    numPages: doc.numPages,
    page: async (number) => {
      const page = await doc.getPage(number);
      const base = page.getViewport({ scale: 1 });
      return {
        width: base.width,
        height: base.height,
        draw: (canvas, scale) => page.render({ canvas, viewport: page.getViewport({ scale }) }),
      };
    },
  };
}

/** Old browsers (TV browsers showing /screen) get pdf.js 3, as the Cast receiver does. */
async function openLegacy(url: string): Promise<ShownPdf> {
  const doc = await loadLegacyPdf(url);
  return {
    numPages: doc.numPages,
    page: async (number) => {
      const page = await doc.getPage(number);
      const base = page.getViewport({ scale: 1 });
      return {
        width: base.width,
        height: base.height,
        draw: (canvas, scale) => {
          const canvasContext = canvas.getContext('2d');
          if (!canvasContext) throw new Error('No canvas');
          return page.render({ canvasContext, viewport: page.getViewport({ scale }) });
        },
      };
    },
  };
}

function loadPdf(url: string): Promise<ShownPdf> {
  let pending = documents.get(url);
  if (!pending) {
    pending = needsLegacyPdf() ? openLegacy(url) : openModern(url).catch(() => openLegacy(url));
    documents.set(url, pending);
    pending.catch(() => documents.delete(url));
  }
  return pending;
}

interface Props {
  url: string;
  /** 1-based page number; clamped to the document. */
  page: number;
  onPageCount?: (count: number) => void;
  label: string;
}

/** Renders one page of a PDF (draft layouts) to fit its container, sharp on high-DPI screens. */
export function PdfPage({ url, page, onPageCount, label }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!size.width || !size.height) return;
    // Until the new page is drawn, ink waits instead of lying over the old page.
    if (canvas.current) delete canvas.current.dataset.inkReady;
    let cancelled = false;
    let task: { cancel(): void; promise: Promise<void> } | null = null;
    loadPdf(url)
      .then(async (doc) => {
        if (cancelled) return;
        onPageCount?.(doc.numPages);
        const pdfPage = await doc.page(Math.min(Math.max(1, page), doc.numPages));
        const scale = Math.min(size.width / pdfPage.width, size.height / pdfPage.height);
        const ratio = window.devicePixelRatio || 1;
        const width = pdfPage.width * scale * ratio;
        const height = pdfPage.height * scale * ratio;
        if (cancelled) return;
        // Draw off screen, then copy: overlapping renders (fast page turns, resizes) never fight over one canvas.
        const offscreen = document.createElement('canvas');
        offscreen.width = Math.floor(width);
        offscreen.height = Math.floor(height);
        task = pdfPage.draw(offscreen, scale * ratio);
        await task.promise;
        const target = canvas.current;
        if (!target || cancelled) return;
        target.width = offscreen.width;
        target.height = offscreen.height;
        target.style.width = `${Math.floor(width / ratio)}px`;
        target.style.height = `${Math.floor(height / ratio)}px`;
        target.getContext('2d')?.drawImage(offscreen, 0, 0);
        target.dataset.inkReady = '1';
      })
      .catch((cause: unknown) => {
        if (cancelled || (cause instanceof Error && cause.name === 'RenderingCancelledException')) return;
        setError('This file could not be shown.');
      });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [url, page, size, onPageCount]);

  return (
    <div ref={box} className="flex h-full w-full items-center justify-center">
      {error ? (
        <p className="text-lg text-bark-500">{error}</p>
      ) : (
        <canvas
          ref={canvas}
          role="img"
          aria-label={label}
          className="rounded-lg bg-white shadow-sm"
          data-ink-target=""
        />
      )}
    </div>
  );
}
