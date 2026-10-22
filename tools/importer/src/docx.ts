import mammoth from 'mammoth';
import { parse, type HTMLElement } from 'node-html-parser';

/** Convert a .docx file to an HTML element tree. Embedded images are dropped. */
export async function docxToHtml(file: string): Promise<HTMLElement> {
  const result = await mammoth.convertToHtml(
    { path: file },
    { convertImage: mammoth.images.imgElement(async () => ({ src: '' })) },
  );
  return parse(result.value);
}

/** Text of an element with paragraphs and list items on separate lines. */
export function blockText(element: HTMLElement): string {
  const blocks = element.querySelectorAll('p, li');
  if (blocks.length === 0) return clean(element.text);
  return blocks
    .map((block) => clean(block.text))
    .filter(Boolean)
    .join('\n');
}

export function clean(text: string): string {
  return text
    .replaceAll(/\u00a0/g, ' ')
    .replaceAll(/[ \t]+/g, ' ')
    .trim();
}

/** Top-level element children (skips text nodes). */
export function elementsOf(root: HTMLElement): HTMLElement[] {
  return root.childNodes.filter((node): node is HTMLElement => node.nodeType === 1);
}
