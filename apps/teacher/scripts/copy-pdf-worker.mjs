// Copies the pdf.js worker into public/ so the browser (and the offline cache) can load it from our own origin.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const source = require.resolve('pdfjs-dist/build/pdf.worker.min.mjs');
const target = path.resolve(import.meta.dirname, '../public/pdf.worker.min.mjs');
mkdirSync(path.dirname(target), { recursive: true });
copyFileSync(source, target);
