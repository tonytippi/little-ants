/**
 * pdf.js 3's legacy build, for old browsers (classroom TVs run Chrome 92 or older TV browsers), which pdf.js 6
 * does not support even in its legacy build. It is copied to /pdfjs-legacy/ at build time (package alias
 * `pdfjs-tv`) and loaded as a classic script. Shared by the Cast receiver (plain ES2020) and the Teacher app.
 */

export interface LegacyPdfPage {
  getViewport(options: { scale: number }): { width: number; height: number };
  render(options: { canvasContext: CanvasRenderingContext2D; viewport: unknown }): {
    promise: Promise<void>;
    cancel(): void;
  };
}

export interface LegacyPdfDocument {
  numPages: number;
  getPage(number: number): Promise<LegacyPdfPage>;
}

interface PdfLibrary {
  GlobalWorkerOptions: { workerSrc: string };
  // isEvalSupported: false closes CVE-2024-4367 (font code execution) in pdf.js 3.
  getDocument(options: { url: string; isEvalSupported: boolean }): { promise: Promise<LegacyPdfDocument> };
}

let library: Promise<PdfLibrary> | null = null;
const documents = new Map<string, Promise<LegacyPdfDocument>>();

function loadLibrary(): Promise<PdfLibrary> {
  if (!library) {
    library = new Promise<PdfLibrary>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/pdfjs-legacy/pdf.min.js';
      script.onload = () => {
        const pdfjs = (window as unknown as { pdfjsLib?: PdfLibrary }).pdfjsLib;
        if (!pdfjs) return reject(new Error('pdf.js did not load'));
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs-legacy/pdf.worker.min.js';
        resolve(pdfjs);
      };
      script.onerror = () => reject(new Error('pdf.js did not load'));
      document.head.appendChild(script);
    });
    library.catch(() => {
      library = null;
    });
  }
  return library;
}

/** Opens a PDF once per URL with pdf.js 3. */
export function loadLegacyPdf(url: string): Promise<LegacyPdfDocument> {
  let pending = documents.get(url);
  if (!pending) {
    pending = loadLibrary().then((pdfjs) => pdfjs.getDocument({ url, isEvalSupported: false }).promise);
    documents.set(url, pending);
    pending.catch(() => documents.delete(url));
  }
  return pending;
}

/** pdf.js 6 needs a recent browser; `Promise.withResolvers` (Chrome 119, 2023) is one of the newest things it uses. */
export function needsLegacyPdf(): boolean {
  return typeof (Promise as unknown as { withResolvers?: unknown }).withResolvers !== 'function';
}
