import { afterEach, describe, expect, it, vi } from 'vitest';
import { TvAudio } from '../src/lib/tv-audio';
import type { TvAudioStatus, TvMessage } from '../src/lib/tv-link';

function setup() {
  const sent: TvMessage[] = [];
  let report: (status: TvAudioStatus) => void = () => undefined;
  let now = 0;
  const audio = new TvAudio(
    (message) => sent.push(message),
    (listener) => {
      report = listener;
      return () => undefined;
    },
    () => now,
  );
  return {
    audio,
    sent,
    report: (status: Partial<TvAudioStatus>) =>
      report({ trackId: 'https://media/a.mp3', playing: false, current: 0, duration: 10, ...status }),
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe('TvAudio: recordings played on the TV', () => {
  afterEach(() => vi.useRealTimers());

  it('loads and plays on the TV and resolves once the TV plays', async () => {
    const { audio, sent, report } = setup();
    audio.src = 'https://media/a.mp3';
    const started = audio.play();
    report({ playing: true });
    await expect(started).resolves.toBeUndefined();
    expect(sent).toEqual([
      { type: 'audio', action: 'load', track: { id: 'https://media/a.mp3', url: 'https://media/a.mp3' } },
      { type: 'audio', action: 'play' },
    ]);
    audio.dispose();
  });

  it('estimates the position between reports and ends when the TV finishes', () => {
    const { audio, report, advance } = setup();
    const ended = vi.fn();
    audio.onended = ended;
    audio.src = 'https://media/a.mp3';
    void audio.play();
    report({ playing: true, current: 2 });
    advance(1500);
    expect(audio.currentTime).toBeCloseTo(3.5);
    expect(audio.duration).toBe(10);
    report({ playing: false, current: 10 });
    expect(ended).toHaveBeenCalledOnce();
    audio.dispose();
  });

  it('rejects like a blocked browser when the TV needs a tap, and ignores other tracks', async () => {
    const { audio, report } = setup();
    audio.src = 'https://media/a.mp3';
    const started = audio.play();
    report({ trackId: 'https://media/old.mp3', playing: true });
    report({ blocked: true });
    await expect(started).rejects.toMatchObject({ name: 'NotAllowedError' });
    audio.dispose();
  });
});
