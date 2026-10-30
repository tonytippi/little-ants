'use client';

import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';

const documents = new Map<string, Promise<PDFDocumentProxy>>();

async function loadPdf(url: string): Promise<PDFDocumentProxy> {
  let pending = documents.get(url);
  if (!pending) {
    pending = (async () => {
      const pdfjs = await import('pdfjs-dist');
      // Served from our own origin (copied at build time) so it is cached for offline use.
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      return pdfjs.getDocument({ url }).promise;
    })();
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
        const pdfPage = await doc.getPage(Math.min(Math.max(1, page), doc.numPages));
        const base = pdfPage.getViewport({ scale: 1 });
        const scale = Math.min(size.width / base.width, size.height / base.height);
        const ratio = window.devicePixelRatio || 1;
        const viewport = pdfPage.getViewport({ scale: scale * ratio });
        if (cancelled) return;
        // Draw off screen, then copy: overlapping renders (fast page turns, resizes) never fight over one canvas.
        const offscreen = document.createElement('canvas');
        offscreen.width = Math.floor(viewport.width);
        offscreen.height = Math.floor(viewport.height);
        task = pdfPage.render({ canvas: offscreen, viewport });
        await task.promise;
        const target = canvas.current;
        if (!target || cancelled) return;
        target.width = offscreen.width;
        target.height = offscreen.height;
        target.style.width = `${Math.floor(viewport.width / ratio)}px`;
        target.style.height = `${Math.floor(viewport.height / ratio)}px`;
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
