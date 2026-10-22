import type { HTMLElement } from 'node-html-parser';
import { blockText, clean, elementsOf } from './docx.js';
import { isMaterialCode } from './mapping.js';
import type { ContentTextEntry } from './types.js';

/**
 * Parse UNN_Content-Texts.docx: each material starts with a heading "CODE – Title",
 * followed by an italic format line, "Page N: …" lines and labelled lines.
 */
export function parseContentTexts(root: HTMLElement): Map<string, ContentTextEntry> {
  const entries = new Map<string, ContentTextEntry>();
  let current: ContentTextEntry | null = null;

  for (const element of elementsOf(root)) {
    const tag = element.tagName.toLowerCase();
    const text = clean(element.text);
    if (/^h[1-4]$/.test(tag)) {
      const match = /^([A-Z]{2}\d*)\s*[–-]\s*(.+)$/.exec(text);
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
    for (const line of blockText(element).split('\n').filter(Boolean)) {
      const page = /^Page (\d+):\s*(.*)$/.exec(line);
      if (page) {
        current.pages.push({ number: Number(page[1]), text: page[2]!.trim() });
      } else if (/^Target language:/i.test(line)) {
        current.targetLanguage = line.replace(/^Target language:\s*/i, '');
      } else if (/^Actions?:/i.test(line)) {
        current.actions = line.replace(/^Actions?:\s*/i, '');
      } else if (!current.format && element.querySelector('em') && current.lines.length === 0) {
        current.format = line;
      } else {
        current.lines.push(line);
      }
    }
  }
  return entries;
}
