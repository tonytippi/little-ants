// Copies pdf.js files into public/ so the browser (and the offline cache) can load them from our own origin:
// the worker for the Teacher app, and the legacy build (library and worker) for the Cast receiver, which runs in
// the older browser of classroom TVs.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const publicDir = path.resolve(import.meta.dirname, '../public');
const files = [
  ['pdfjs-dist/build/pdf.worker.min.mjs', 'pdf.worker.min.mjs'],
  ['pdfjs-dist/legacy/build/pdf.min.mjs', 'pdfjs-legacy/pdf.min.mjs'],
  ['pdfjs-dist/legacy/build/pdf.worker.min.mjs', 'pdfjs-legacy/pdf.worker.min.mjs'],
];
for (const [source, target] of files) {
  const to = path.join(publicDir, target);
  mkdirSync(path.dirname(to), { recursive: true });
  copyFileSync(require.resolve(source), to);
}
