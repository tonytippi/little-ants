'use client';

import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import type { InkMessage } from '../../lib/cast-protocol';
import {
  HIGHLIGHTER_OPACITY,
  INK_WIDTHS,
  measureInkRect,
  quantise,
  sameRect,
  simplify,
  strokePath,
  strokeWidth,
  strokesAt,
  type InkRect,
  type InkStroke,
  type InkTool,
} from '../../lib/ink';

export type DrawTool = InkTool | 'eraser' | 'move';

/** What the teacher's pen does; absent on TVs and outside wide mode. */
export interface InkEditor {
  tool: DrawTool;
  color: string;
  /** The stroke being drawn, at most every LIVE_MS. */
  onLive: (stroke: InkStroke) => void;
  onStroke: (stroke: InkStroke) => void;
  onErase: (ids: string[]) => void;
}

const LIVE_MS = 60;
/** Simplification tolerance and eraser reach, in thousandths of the content width. */
const TOLERANCE = 1.5;
const ERASER_RADIUS = 15;
/** A longer stroke is cut into pieces, so each still fits one message. */
const MAX_STROKE_POINTS = 1500;
/** Once a stylus has been used, a hand resting on the screen does not draw (until the page is reloaded). */
let sawPen = false;

interface Gesture {
  pointerId: number;
  pointerType: string;
  stroke: InkStroke | null;
  erased: Set<string>;
  sent: number;
}

/**
 * Ink over the stage body, anchored to the picture or page shown (see `measureInkRect`). Place it inside the
 * stage body (its parent), which it measures again whenever the picture loads, the page changes or the size does.
 */
export function InkLayer({
  strokes,
  live = null,
  editor = null,
}: {
  strokes: InkStroke[];
  live?: InkStroke | null;
  editor?: InkEditor | null;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [rect, setRect] = useState<InkRect | null>(null);
  const [drawing, setDrawing] = useState<InkStroke | null>(null);
  const [erased, setErased] = useState<ReadonlySet<string>>(new Set());
  const gesture = useRef<Gesture | null>(null);
  const drawingTool = editor && editor.tool !== 'move' ? editor : null;
  const latestTool = useRef(drawingTool);
  useEffect(() => {
    latestTool.current = drawingTool;
  });

  // Leaving wide mode or the page mid-stroke keeps the stroke (and so tells the TV the stroke has ended).
  useEffect(
    () => () => {
      const stroke = gesture.current?.stroke;
      gesture.current = null;
      if (stroke) latestTool.current?.onStroke({ ...stroke, points: simplify(stroke.points, TOLERANCE) });
    },
    [],
  );

  useEffect(() => {
    const element = svg.current;
    const container = element?.parentElement;
    if (!element || !container) return;
    let pending = 0;
    const update = (): void => {
      cancelAnimationFrame(pending);
      pending = requestAnimationFrame(() => {
        const next = measureInkRect(container);
        setRect((previous) => (sameRect(previous, next) ? previous : next));
      });
    };
    const resize = new ResizeObserver(update);
    resize.observe(container);
    // A new picture or page, or a PDF page finished drawing; changes inside the ink itself do not count.
    const mutations = new MutationObserver((records) => {
      if (records.some((record) => !element.contains(record.target))) update();
    });
    mutations.observe(container, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['src', 'style', 'width', 'height', 'data-ink-ready'],
    });
    container.addEventListener('load', update, true);
    update();
    return () => {
      cancelAnimationFrame(pending);
      resize.disconnect();
      mutations.disconnect();
      container.removeEventListener('load', update, true);
    };
  }, []);

  const pointAt = useCallback(
    (event: PointerEvent<SVGSVGElement>): [number, number] | null => {
      const box = svg.current?.getBoundingClientRect();
      if (!box || !rect) return null;
      return [
        quantise((event.clientX - box.left - rect.x) / rect.width),
        quantise((event.clientY - box.top - rect.y) / rect.height),
      ];
    },
    [rect],
  );

  function eraseAt(point: [number, number]): void {
    const current = gesture.current;
    if (!current || !rect) return;
    const hits = strokesAt(strokes, point[0], point[1], ERASER_RADIUS, rect.height / rect.width);
    if (hits.every((id) => current.erased.has(id))) return;
    hits.forEach((id) => current.erased.add(id));
    setErased(new Set(current.erased));
  }

  function newStroke(tool: InkEditor, points: number[]): InkStroke {
    const kind: InkTool = tool.tool === 'highlighter' ? 'highlighter' : 'pen';
    return { id: crypto.randomUUID(), tool: kind, color: tool.color, width: INK_WIDTHS[kind], points };
  }

  function onPointerDown(event: PointerEvent<SVGSVGElement>): void {
    if (!drawingTool) return;
    if (event.pointerType === 'pen') {
      sawPen = true;
      // The hand touched the screen just before the stylus: drop what the hand started.
      const current = gesture.current;
      if (current && current.pointerType === 'touch') {
        gesture.current = null;
        if (event.currentTarget.hasPointerCapture(current.pointerId))
          event.currentTarget.releasePointerCapture(current.pointerId);
        setDrawing(null);
        setErased(new Set());
      }
    } else if (event.pointerType === 'touch' && sawPen) return;
    if (gesture.current) return;
    const point = pointAt(event);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const start = {
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      erased: new Set<string>(),
      sent: 0,
    };
    if (drawingTool.tool === 'eraser') {
      gesture.current = { ...start, stroke: null };
      eraseAt(point);
      return;
    }
    const stroke = newStroke(drawingTool, point);
    gesture.current = { ...start, stroke };
    setDrawing(stroke);
  }

  function onPointerMove(event: PointerEvent<SVGSVGElement>): void {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId || !drawingTool) return;
    const point = pointAt(event);
    if (!point) return;
    if (!current.stroke) {
      eraseAt(point);
      return;
    }
    const points = current.stroke.points;
    if (points[points.length - 2] === point[0] && points[points.length - 1] === point[1]) return;
    if (points.length >= MAX_STROKE_POINTS * 2) {
      drawingTool.onStroke({ ...current.stroke, points: simplify(points, TOLERANCE) });
      current.stroke = newStroke(drawingTool, points.slice(-2));
    }
    current.stroke = { ...current.stroke, points: [...current.stroke.points, ...point] };
    setDrawing(current.stroke);
    const now = performance.now();
    if (now - current.sent >= LIVE_MS) {
      current.sent = now;
      drawingTool.onLive({ ...current.stroke, points: simplify(current.stroke.points, TOLERANCE) });
    }
  }

  function onPointerEnd(event: PointerEvent<SVGSVGElement>): void {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    gesture.current = null;
    if (current.stroke) {
      drawingTool?.onStroke({ ...current.stroke, points: simplify(current.stroke.points, TOLERANCE) });
      setDrawing(null);
    } else {
      if (current.erased.size) drawingTool?.onErase([...current.erased]);
      setErased(new Set());
    }
  }

  const shown = strokes.filter((stroke) => !erased.has(stroke.id));
  if (live) shown.push(live);
  if (drawing) shown.push(drawing);

  return (
    <svg
      ref={svg}
      className="absolute inset-0 z-10 h-full w-full overflow-visible"
      style={{ pointerEvents: drawingTool ? 'auto' : 'none', touchAction: drawingTool ? 'none' : 'auto' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onLostPointerCapture={onPointerEnd}
      aria-hidden="true"
    >
      {rect
        ? shown.map((stroke) => (
            <path
              key={stroke.id}
              d={strokePath(stroke.points, rect)}
              fill="none"
              stroke={stroke.color}
              strokeWidth={strokeWidth(stroke, rect)}
              strokeOpacity={stroke.tool === 'highlighter' ? HIGHLIGHTER_OPACITY : 1}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))
        : null}
    </svg>
  );
}

/** Ink a TV window received from the teacher: the page's strokes and the stroke being drawn. */
export interface ReceivedInk {
  key: string;
  strokes: InkStroke[];
  live: InkStroke | null;
}

export function useReceivedInk(): [ReceivedInk, (message: InkMessage) => void, () => void] {
  const [ink, setInk] = useState<ReceivedInk>({ key: '', strokes: [], live: null });
  const onInk = useCallback((message: InkMessage) => {
    setInk((previous) =>
      message.type === 'ink'
        ? { key: message.key, strokes: message.strokes, live: null }
        : {
            key: message.key,
            strokes: message.key === previous.key ? previous.strokes : [],
            live: message.stroke,
          },
    );
  }, []);
  const clear = useCallback(() => setInk({ key: '', strokes: [], live: null }), []);
  return [ink, onInk, clear];
}

/** The received ink for the page the TV shows (none while it shows another page or the logo). */
export function ReceivedInkLayer({ ink, surface }: { ink: ReceivedInk; surface: string }) {
  if (!surface || ink.key !== surface) return null;
  return <InkLayer strokes={ink.strokes} live={ink.live} />;
}
