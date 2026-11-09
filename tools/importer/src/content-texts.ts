import { isMaterialCode } from './mapping.js';
import type { ContentTextEntry } from './types.js';

/** Line text without Markdown markup: bold/italic markers, list bullets, escapes and hard line breaks. */
function plain(line: string): string {
  return line
    .replace(/^\s*[-*+]\s+/, '')
    .replaceAll(/\*\*(.+?)\*\*/g, '$1')
    .replaceAll(/(^|[^\w*])\*(?!\s)(.+?)\*(?!\w)/g, '$1$2')
    .replaceAll(/\\([\\`*_{}[\]()#+\-.!|>~'"])/g, '$1')
    .replaceAll(/\u00a0/g, ' ')
    .replaceAll(/[ \t]+/g, ' ')
    .trim();
}

/** A whole line in italics ("*Routine song*"): the material's format line. */
function isItalicLine(line: string): boolean {
  return /^\*(?!\*)\S.*\S?\*$/.test(line.trim()) || /^_(?!_)\S.*_$/.test(line.trim());
}

/**
 * Parse UNN_Content-Texts.md: each material starts with a heading "### CODE – Title",
 * followed by an italic format line, "**Page N:** …" lines and labelled lines ("Target language:", "Actions:").
 * Blank lines (between verses) are dropped; headings that are not a material code end the current material.
 */
export function parseContentTexts(markdown: string): Map<string, ContentTextEntry> {
  const entries = new Map<string, ContentTextEntry>();
  let current: ContentTextEntry | null = null;

  for (const raw of markdown.replaceAll(/<!--[\s\S]*?-->/g, '').split(/\r?\n/)) {
    const heading = /^#{1,6}\s+(.*)$/.exec(raw);
    if (heading) {
      const match = /^([A-Z]{2}\d*)\s*[–-]\s*(.+)$/.exec(plain(heading[1]!));
      if (match && isMaterialCode(match[1]!)) {
        current = {
          code: match[1]!,
          title: match[2]!.trim(),
          format: '',
          pages: [],
          lines: [],
          targetLanguage: '',
          actions: '',
        };
        entries.set(current.code, current);
      } else {
        current = null;
      }
      continue;
    }
    if (!current) continue;
    const line = plain(raw);
    if (!line) continue;
    const page = /^Page (\d+):\s*(.*)$/.exec(line);
    if (page) {
      current.pages.push({ number: Number(page[1]), text: page[2]!.trim() });
    } else if (/^Target language:/i.test(line)) {
      current.targetLanguage = line.replace(/^Target language:\s*/i, '');
    } else if (/^Actions?:/i.test(line)) {
      current.actions = line.replace(/^Actions?:\s*/i, '');
    } else if (!current.format && current.lines.length === 0 && isItalicLine(raw)) {
      current.format = line;
    } else {
      current.lines.push(line);
    }
  }
  return entries;
}
