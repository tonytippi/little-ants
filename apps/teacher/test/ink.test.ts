import { describe, expect, it } from 'vitest';
import { SCREEN_MESSAGE_LIMIT } from '@little-ants/shared';
import {
  EMPTY_SURFACE,
  MAX_STROKES,
  capStrokes,
  fitRect,
  inkCommit,
  inkRedo,
  inkUndo,
  quantise,
  simplify,
  strokePath,
  strokesAt,
  type InkStroke,
} from '../src/lib/ink';

const stroke = (id: string, points: number[], width = 6): InkStroke => ({
  id,
  tool: 'pen',
  color: '#e5484d',
  width,
  points,
});

describe('ink points', () => {
  it('stores fractions of the content box as thousandths, a little outside it at most', () => {
    expect(quantise(0.5)).toBe(500);
    expect(quantise(0.12345)).toBe(123);
    expect(quantise(1.2)).toBe(1200);
    expect(quantise(-5)).toBe(-1000);
    expect(quantise(9)).toBe(2000);
  });

  it('drops points on a straight line and keeps the ends and corners', () => {
    expect(simplify([0, 0, 100, 0, 200, 0, 300, 0], 1)).toEqual([0, 0, 300, 0]);
    expect(simplify([0, 0, 100, 0, 100, 100], 1)).toEqual([0, 0, 100, 0, 100, 100]);
    expect(simplify([5, 5], 1)).toEqual([5, 5]);
  });

  it('draws in the box it is anchored to, wherever the box is', () => {
    const rect = { x: 100, y: 50, width: 200, height: 100 };
    expect(strokePath([0, 0, 1000, 1000], rect)).toBe('M100 50L300 150');
    expect(strokePath([500, 500], rect)).toBe('M200 100L200 100');
    expect(strokePath([0, 0, 500, 0, 1000, 1000], rect)).toBe('M100 50Q200 50 250 100L300 150');
  });

  it('fits the content box in the middle of the stage', () => {
    expect(fitRect(1600, 1000, 16 / 9)).toEqual({ x: 0, y: 50, width: 1600, height: 900 });
    expect(fitRect(1000, 1000, 2)).toEqual({ x: 0, y: 250, width: 1000, height: 500 });
  });
});

describe('erasing', () => {
  it('finds the strokes under the eraser, in units of the box width', () => {
    const strokes = [stroke('a', [0, 0, 1000, 0]), stroke('b', [0, 500, 1000, 500])];
    expect(strokesAt(strokes, 500, 10, 15, 1)).toEqual(['a']);
    expect(strokesAt(strokes, 500, 250, 15, 1)).toEqual([]);
    // 20 thousandths of the height away from "b": out of reach in a square box, but only 10 of the width (in
    // reach) in a box half as tall as wide.
    expect(strokesAt(strokes, 500, 480, 15, 1)).toEqual([]);
    expect(strokesAt(strokes, 500, 480, 15, 0.5)).toEqual(['b']);
  });
});

describe('a page of ink', () => {
  it('undoes and redoes each change', () => {
    const one = inkCommit(EMPTY_SURFACE, [stroke('a', [0, 0])]);
    const two = inkCommit(one, [...one.strokes, stroke('b', [1, 1])]);
    expect(inkUndo(two).strokes.map((s) => s.id)).toEqual(['a']);
    expect(inkRedo(inkUndo(two)).strokes.map((s) => s.id)).toEqual(['a', 'b']);
    expect(inkUndo(inkUndo(two)).strokes).toEqual([]);
    expect(inkUndo(EMPTY_SURFACE)).toBe(EMPTY_SURFACE);
    const cleared = inkCommit(two, []);
    expect(cleared.redo).toEqual([]);
    expect(inkUndo(cleared).strokes).toHaveLength(2);
  });

  it('keeps the newest strokes that fit one message', () => {
    const long = Array.from({ length: 400 }, (_, i) => (i * 7) % 1000);
    const many = Array.from({ length: 200 }, (_, i) => stroke(`s${i}`, long));
    const kept = capStrokes(many);
    expect(kept.length).toBeLessThanOrEqual(MAX_STROKES);
    expect(kept[kept.length - 1]?.id).toBe('s199');
    const message = JSON.stringify({ type: 'ink', key: '12:material:30', strokes: kept });
    expect(message.length).toBeLessThan(SCREEN_MESSAGE_LIMIT);
    const huge = stroke(
      'huge',
      Array.from({ length: 20_000 }, (_, i) => i % 1000),
    );
    expect(capStrokes([stroke('old', [0, 0]), huge]).map((s) => s.id)).toEqual(['old']);
    const short = Array.from({ length: 120 }, (_, i) => stroke(`s${i}`, [0, 0, 10, 10]));
    expect(capStrokes(short)).toHaveLength(MAX_STROKES);
  });
});
