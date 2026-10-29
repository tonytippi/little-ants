import { describe, expect, it } from 'vitest';
import { screenCodeFromScan } from '@little-ants/shared';
import { isReceiverMessage, isSenderMessage } from '../src/lib/cast-protocol';
import { clampNoteSize } from '../src/lib/note-size';

describe('Cast messages', () => {
  it('accepts only known teacher → TV messages', () => {
    expect(isSenderMessage({ type: 'frame', frame: {} })).toBe(true);
    expect(isSenderMessage({ type: 'end' })).toBe(true);
    expect(isSenderMessage({ type: 'audio', action: 'play' })).toBe(true);
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
    expect(screenCodeFromScan('https://la-teacher.passionedu.org/screen/pair?code=ABC234')).toBe('ABC234');
    expect(screenCodeFromScan(' abc-234 ')).toBe('ABC234');
    expect(screenCodeFromScan('https://example.com/other?code=ABC234')).toBeNull();
    // Look-alike characters are not in codes.
    expect(screenCodeFromScan('ABC230')).toBeNull();
    expect(screenCodeFromScan('ABCD')).toBeNull();
  });
});
