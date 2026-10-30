/**
 * Drawing on the stage ("ink"), shared by the Teacher app, its TV windows and the plain Cast receiver for old TVs,
 * so it uses no React and no syntax newer than ES2020.
 *
 * A stroke is anchored to the picture or PDF page on the stage, not to the screen: points are thousandths of that
 * content box, so a circle drawn around a picture on a tablet lands on the same picture on a TV of another shape.
 * Points may lie a little outside the box (to underline the text under a picture). Without a picture or page, the
 * box is a 16:9 board in the middle of the stage.
 */

export type InkTool = 'pen' | 'highlighter';

export interface InkStroke {
  id: string;
  tool: InkTool;
  color: string;
  /** Thousandths of the content box width. */
  width: number;
  /** x0, y0, x1, y1 … in thousandths of the content box. */
  points: number[];
}

export interface InkRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const INK_COLORS = ['#e5484d', '#2f6fdf', '#2e9e5b', '#f5b400', '#2b1d16'];
export const INK_WIDTHS: Record<InkTool, number> = { pen: 6, highlighter: 30 };
export const HIGHLIGHTER_OPACITY = 0.35;
/** Strokes kept per page; the oldest go first. */
export const MAX_STROKES = 80;
/** A whole page of ink must fit in one Cast or relay message (64 000 characters), with room for the envelope. */
export const MAX_INK_CHARS = 56_000;
const UNIT = 1000;
const MIN_POINT = -UNIT;
const MAX_POINT = 2 * UNIT;
const BOARD_ASPECT = 16 / 9;

/** Ink belongs to one page of one step's view: turning the page shows that page's ink. */
export function surfaceKey(step: number, view: string, page: number): string {
  return `${step}:${view}:${page}`;
}

/** A fraction of the content box (1 = its width or height) as a stored point. */
export function quantise(fraction: number): number {
  return Math.min(MAX_POINT, Math.max(MIN_POINT, Math.round(fraction * UNIT)));
}

function segmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Ramer–Douglas–Peucker: drops points closer than `tolerance` to the line through their neighbours. */
export function simplify(points: number[], tolerance: number): number[] {
  const count = points.length / 2;
  if (count <= 2) return points.slice();
  const keep = new Array<boolean>(count).fill(false);
  keep[0] = true;
  keep[count - 1] = true;
  const stack: [number, number][] = [[0, count - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    let farthest = -1;
    let distance = tolerance;
    for (let i = first + 1; i < last; i++) {
      const d = segmentDistance(
        points[2 * i]!,
        points[2 * i + 1]!,
        points[2 * first]!,
        points[2 * first + 1]!,
        points[2 * last]!,
        points[2 * last + 1]!,
      );
      if (d > distance) {
        distance = d;
        farthest = i;
      }
    }
    if (farthest > 0) {
      keep[farthest] = true;
      stack.push([first, farthest], [farthest, last]);
    }
  }
  const result: number[] = [];
  keep.forEach((kept, i) => {
    if (kept) result.push(points[2 * i]!, points[2 * i + 1]!);
  });
  return result;
}

/** SVG path for a stroke drawn in `rect` (pixels): smooth curves through the midpoints. */
export function strokePath(points: number[], rect: InkRect): string {
  const x = (i: number): number => Math.round((rect.x + (points[2 * i]! / UNIT) * rect.width) * 10) / 10;
  const y = (i: number): number => Math.round((rect.y + (points[2 * i + 1]! / UNIT) * rect.height) * 10) / 10;
  const count = points.length / 2;
  if (count === 0) return '';
  if (count === 1) return `M${x(0)} ${y(0)}L${x(0)} ${y(0)}`;
  let path = `M${x(0)} ${y(0)}`;
  for (let i = 1; i < count - 1; i++) {
    const mx = Math.round(((x(i) + x(i + 1)) / 2) * 10) / 10;
    const my = Math.round(((y(i) + y(i + 1)) / 2) * 10) / 10;
    path += `Q${x(i)} ${y(i)} ${mx} ${my}`;
  }
  return `${path}L${x(count - 1)} ${y(count - 1)}`;
}

/** Stroke width in pixels for `rect`, never thinner than 2 px. */
export function strokeWidth(stroke: InkStroke, rect: InkRect): number {
  return Math.max(2, (stroke.width / UNIT) * rect.width);
}

/** The newest strokes that fit `MAX_STROKES` and one message. */
export function capStrokes(strokes: InkStroke[]): InkStroke[] {
  const kept: InkStroke[] = [];
  let size = 0;
  for (let i = strokes.length - 1; i >= 0 && kept.length < MAX_STROKES; i--) {
    const length = JSON.stringify(strokes[i]).length + 1;
    // A stroke too big for what is left is skipped, not the reason to drop every older one.
    if (size + length > MAX_INK_CHARS) continue;
    size += length;
    kept.unshift(strokes[i]!);
  }
  return kept;
}

/** Ids of the strokes passing within `radius` (thousandths of the box width) of the point. */
export function strokesAt(
  strokes: InkStroke[],
  x: number,
  y: number,
  radius: number,
  aspect: number,
): string[] {
  // Distances in box-width units: y is scaled by the box's height / width.
  const hits: string[] = [];
  for (const stroke of strokes) {
    const p = stroke.points;
    const reach = radius + stroke.width / 2;
    let hit = false;
    for (let i = 0; i < p.length / 2 && !hit; i++) {
      const j = Math.min(i + 1, p.length / 2 - 1);
      hit =
        segmentDistance(
          x,
          y * aspect,
          p[2 * i]!,
          p[2 * i + 1]! * aspect,
          p[2 * j]!,
          p[2 * j + 1]! * aspect,
        ) <= reach;
    }
    if (hit) hits.push(stroke.id);
  }
  return hits;
}

/** `width × height` of the given aspect, as large as fits in the box and centred in it. */
export function fitRect(boxWidth: number, boxHeight: number, aspect: number): InkRect {
  const width = Math.min(boxWidth, boxHeight * aspect);
  const height = width / aspect;
  return { x: (boxWidth - width) / 2, y: (boxHeight - height) / 2, width, height };
}

/**
 * Where ink is anchored inside `container`, in pixels from its top left: the drawn part of the first element
 * marked `data-ink-target` (a picture, or a PDF canvas once `data-ink-ready` is set), or a 16:9 board.
 * Null while the picture or page is still loading.
 */
export function measureInkRect(container: HTMLElement): InkRect | null {
  const box = container.getBoundingClientRect();
  if (!box.width || !box.height) return null;
  const target = container.querySelector<HTMLElement>('[data-ink-target]');
  if (!target) return fitRect(box.width, box.height, BOARD_ASPECT);
  let natural: { width: number; height: number };
  if (target instanceof HTMLImageElement)
    natural = { width: target.naturalWidth, height: target.naturalHeight };
  else if (target instanceof HTMLCanvasElement && target.dataset.inkReady)
    natural = { width: target.width, height: target.height };
  else return null;
  if (!natural.width || !natural.height) return null;
  // Pictures are drawn with object-fit: contain, so the drawn part may be smaller than the element.
  const element = target.getBoundingClientRect();
  const fitted = fitRect(element.width, element.height, natural.width / natural.height);
  return {
    x: element.left - box.left + fitted.x,
    y: element.top - box.top + fitted.y,
    width: fitted.width,
    height: fitted.height,
  };
}

export function sameRect(a: InkRect | null, b: InkRect | null): boolean {
  if (!a || !b) return a === b;
  return (
    Math.abs(a.x - b.x) < 0.5 &&
    Math.abs(a.y - b.y) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  );
}

/** One page's ink with its undo and redo history (on the teacher's device). */
export interface InkSurface {
  strokes: InkStroke[];
  undo: InkStroke[][];
  redo: InkStroke[][];
}

export const EMPTY_SURFACE: InkSurface = { strokes: [], undo: [], redo: [] };
const MAX_HISTORY = 50;

/** Replaces the page's strokes, keeping the previous ones for undo. */
export function inkCommit(surface: InkSurface, strokes: InkStroke[]): InkSurface {
  return {
    strokes: capStrokes(strokes),
    undo: [...surface.undo, surface.strokes].slice(-MAX_HISTORY),
    redo: [],
  };
}

export function inkUndo(surface: InkSurface): InkSurface {
  const previous = surface.undo[surface.undo.length - 1];
  if (!previous) return surface;
  return { strokes: previous, undo: surface.undo.slice(0, -1), redo: [...surface.redo, surface.strokes] };
}

export function inkRedo(surface: InkSurface): InkSurface {
  const next = surface.redo[surface.redo.length - 1];
  if (!next) return surface;
  return { strokes: next, undo: [...surface.undo, surface.strokes], redo: surface.redo.slice(0, -1) };
}
