import { describe, expect, it } from 'vitest';
import { screenCodeFromScan } from '@little-ants/shared';
import { isReceiverMessage, isSenderMessage } from '../src/lib/cast-protocol';
import { clampNoteSize } from '../src/lib/note-size';

describe('Cast messages', () => {
  it('accepts only known teacher → TV messages', () => {
    expect(isSenderMessage({ type: 'frame', frame: {} })).toBe(true);
    expect(isSenderMessage({ type: 'end' })).toBe(true);
    expect(isSenderMessage({ type: 'audio', action: 'play' })).toBe(true);
    expect(isSenderMessage({ type: 'ink', key: '0:material:0', strokes: [] })).toBe(true);
    expect(isSenderMessage({ type: 'ink-live', key: '0:material:0', stroke: {} })).toBe(true);
    expect(isSenderMessage({ type: 'ready' })).toBe(false);
    expect(isSenderMessage('frame')).toBe(false);
    expect(isSenderMessage(null)).toBe(false);
  });

  it('accepts only known TV → teacher messages', () => {
    expect(isReceiverMessage({ type: 'ready' })).toBe(true);
    expect(
      isReceiverMessage({ type: 'audio-status', trackId: 'a', playing: true, current: 1, duration: 2 }),
    ).toBe(true);
    expect(isReceiverMessage({ type: 'frame' })).toBe(false);
    expect(isReceiverMessage(undefined)).toBe(false);
  });
});

describe('clampNoteSize', () => {
  it('keeps the stored size within the available sizes', () => {
    expect(clampNoteSize(2)).toBe(2);
    expect(clampNoteSize(-1)).toBe(0);
    expect(clampNoteSize(9)).toBe(3);
    expect(clampNoteSize(Number.NaN)).toBe(0);
    expect(clampNoteSize(1.5)).toBe(0);
  });
});

describe('screen pairing codes', () => {
  it('reads the code from a scanned link or typed text', () => {
    expect(screenCodeFromScan('https://teacher.littleantsenglish.com/screen/pair?code=ABC234')).toBe(
      'ABC234',
    );
    expect(screenCodeFromScan(' abc-234 ')).toBe('ABC234');
    expect(screenCodeFromScan('https://example.com/other?code=ABC234')).toBeNull();
    // Look-alike characters are not in codes.
    expect(screenCodeFromScan('ABC230')).toBeNull();
    expect(screenCodeFromScan('ABCD')).toBeNull();
  });
});

describe('Cast receiver modules', () => {
  // The TV loads the compiled files as plain ES modules: a runtime import must name its file with ".js".
  it('import code only with explicit .js paths', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const files = [
      'cast-receiver/receiver.ts',
      'src/components/player/stage-content.ts',
      'src/lib/cast-protocol.ts',
      'src/lib/presenter.ts',
      'src/lib/ink.ts',
      'src/lib/pdf-legacy.ts',
    ];
    for (const file of files) {
      const source = readFileSync(resolve(__dirname, '..', file), 'utf8');
      const runtimeImports = [...source.matchAll(/^import (?!type )[^;]*?from '([^']+)'/gms)].map(
        (m) => m[1],
      );
      for (const path of runtimeImports) expect(path, `${file} imports ${path}`).toMatch(/\.js$/);
    }
  });
});

describe('laptop screen queue', () => {
  it('keeps the order and only the newest stroke in progress', async () => {
    const { enqueue } = await import('../src/lib/screen-link');
    const live = (n: number) => ({ type: 'ink-live' as const, key: 'k', stroke: { id: String(n) } as never });
    const queue: Parameters<typeof enqueue>[0] = [];
    enqueue(queue, live(1));
    enqueue(queue, { type: 'frame', frame: {} as never });
    enqueue(queue, live(2));
    expect(queue.map((m) => (m.type === 'ink-live' ? `live${m.stroke.id}` : m.type))).toEqual([
      'frame',
      'live2',
    ]);
    enqueue(queue, { type: 'ink', key: 'k', strokes: [] });
    enqueue(queue, { type: 'audio', action: 'pause' });
    expect(queue.map((m) => m.type)).toEqual(['frame', 'ink', 'audio']);
  });
});
