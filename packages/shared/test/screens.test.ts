import { describe, expect, it } from 'vitest';
import { screenCodeFromScan, screenPairUrl } from '../src/screens.js';

describe('screen pairing codes in QR codes', () => {
  it('builds the shared pairing address on the Student app', () => {
    expect(screenPairUrl('https://littleantsenglish.com', 'ABC234')).toBe(
      'https://littleantsenglish.com/tv/pair?code=ABC234',
    );
  });

  it('reads the code from the new and the older address, or from typed text', () => {
    expect(screenCodeFromScan('https://littleantsenglish.com/tv/pair?code=abc234')).toBe('ABC234');
    expect(screenCodeFromScan('https://teacher.littleantsenglish.com/screen/pair?code=ABC234')).toBe(
      'ABC234',
    );
    expect(screenCodeFromScan('abc-234')).toBe('ABC234');
    expect(screenCodeFromScan('https://example.com/other?code=ABC234')).toBeNull();
  });
});
