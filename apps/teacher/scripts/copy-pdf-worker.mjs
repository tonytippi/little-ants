// Copies pdf.js files into public/ so the browser (and the offline cache) can load them from our own origin:
// the worker for the Teacher app, and pdf.js 3's legacy build for the Cast receiver. Classroom TVs run Chrome 92,
// which pdf.js 6 (even its legacy build) no longer supports; pdf.js 3 is installed as `pdfjs-tv` for them only.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const publicDir = path.resolve(import.meta.dirname, '../public');
const files = [
  ['pdfjs-dist/build/pdf.worker.min.mjs', 'pdf.worker.min.mjs'],
  ['pdfjs-tv/legacy/build/pdf.min.js', 'pdfjs-legacy/pdf.min.js'],
  ['pdfjs-tv/legacy/build/pdf.worker.min.js', 'pdfjs-legacy/pdf.worker.min.js'],
];
for (const [source, target] of files) {
  const to = path.join(publicDir, target);
  mkdirSync(path.dirname(to), { recursive: true });
  copyFileSync(require.resolve(source), to);
}
