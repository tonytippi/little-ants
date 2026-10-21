'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReleaseMedia } from '@little-ants/shared';
import { formatClock } from '../../lib/format';

/** Big, simple audio controls. Never starts on its own: the teacher taps Play. */
export function AudioBar({ tracks, compact = false }: { tracks: ReleaseMedia[]; compact?: boolean }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState({ current: 0, duration: 0 });
  const track = tracks[Math.min(index, tracks.length - 1)];
  const trackKey = tracks.map((item) => item.id).join(',');

  // A new step or page brings new tracks: stop and start from the first one.
  useEffect(() => {
    const element = audio.current;
    element?.pause();
    return () => element?.pause();
  }, [trackKey]);

  if (!track) return null;

  function toggle(): void {
    const element = audio.current;
    if (!element) return;
    if (element.paused) void element.play();
    else element.pause();
  }

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl bg-white px-3 py-2 ring-1 ring-cream-200 ${compact ? '' : 'sm:px-4 sm:py-3'}`}
    >
      <audio
        key={track.id}
        ref={audio}
        src={track.url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={(event) => setTime({ current: 0, duration: event.currentTarget.duration || 0 })}
        onTimeUpdate={(event) =>
          setTime({ current: event.currentTarget.currentTime, duration: event.currentTarget.duration || 0 })
        }
      />
      <button
        type="button"
        onClick={toggle}
        className="flex size-14 shrink-0 items-center justify-center rounded-full bg-ant-500 text-2xl text-white shadow-sm hover:bg-ant-600"
        aria-label={playing ? 'Pause audio' : 'Play audio'}
      >
        {playing ? '❚❚' : '▶'}
      </button>
      <button
        type="button"
        onClick={() => {
          if (audio.current) audio.current.currentTime = 0;
        }}
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-cream-100 text-lg text-bark-700 hover:bg-cream-200"
        aria-label="Start the audio again"
      >
        ↺
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-bark-900">{track.fileName}</p>
        <div className="mt-1 flex items-center gap-2 text-xs text-bark-500">
          <input
            type="range"
            min={0}
            max={time.duration || 0}
            step={0.5}
            value={time.current}
            onChange={(event) => {
              if (audio.current) audio.current.currentTime = Number(event.target.value);
            }}
            className="h-2 flex-1 accent-ant-500"
            aria-label="Audio position"
          />
          <span className="tabular-nums">
            {formatClock(time.current)} / {formatClock(time.duration)}
          </span>
        </div>
      </div>
      {tracks.length > 1 ? (
        <select
          value={index}
          onChange={(event) => setIndex(Number(event.target.value))}
          className="max-w-36 rounded-lg border border-cream-200 bg-white px-2 py-1 text-sm"
          aria-label="Choose a track"
        >
          {tracks.map((item, i) => (
            <option key={item.id} value={i}>
              {item.fileName}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}
