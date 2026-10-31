'use client';

import { useEffect, useRef } from 'react';
import type { ListenFrame } from '@little-ants/shared';

/**
 * A Listening Time slide on a home TV, sent by a parent's phone: the picture faded into the page beside the words,
 * with the line being heard highlighted. Sized with vh/vw (old TV browsers ignore dvh) and never scrolls the page.
 */
export function ListenSlide({ frame }: { frame: ListenFrame }) {
  const box = useRef<HTMLDivElement>(null);
  const heard = useRef<HTMLParagraphElement>(null);
  const { current, lines } = frame;

  // Keep the line being heard in view (scrolls the words box only).
  useEffect(() => {
    const container = box.current;
    const line = heard.current;
    if (container && line) container.scrollTop = Math.max(0, line.offsetTop - container.clientHeight / 3);
  }, [current, lines]);

  return (
    <div className="flex h-full w-full items-stretch gap-[3vw] p-[3vw]">
      <div className="relative flex-[1.25]">
        {frame.picture ? (
          // eslint-disable-next-line @next/next/no-img-element -- media from the media domain
          <img
            src={frame.picture.url}
            alt=""
            className={`absolute inset-0 h-full w-full [mask-image:radial-gradient(ellipse_at_center,#000_62%,transparent_80%)] ${frame.cover ? 'object-cover' : 'object-contain'}`}
          />
        ) : frame.big ? (
          <span
            className="absolute inset-0 flex items-center justify-center font-display text-[22vh] font-extrabold leading-none"
            style={{ color: frame.colour }}
          >
            {frame.big}
          </span>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <p className="text-[2.2vh] font-semibold uppercase tracking-wider text-bark-500">{frame.kindLabel}</p>
        <h1 className="font-display text-[6vh] font-extrabold leading-[1.05]" style={{ color: frame.colour }}>
          {frame.title}
        </h1>
        {frame.act ? (
          <p className="mt-[1vh] text-[2.6vh] font-semibold text-bark-700">
            <b style={{ color: frame.colour }}>{frame.act}</b> · {frame.cue}
          </p>
        ) : null}
        {frame.big && frame.picture ? (
          <p
            className="mt-[1vh] font-display text-[12vh] font-extrabold leading-none"
            style={{ color: frame.colour }}
          >
            {frame.big}
            {frame.small ? (
              <span className="ml-[1vw] font-child text-[4vh] text-bark-500">{frame.small}</span>
            ) : null}
          </p>
        ) : null}
        <div
          ref={box}
          className="relative mt-[2vh] max-h-[55vh] overflow-hidden font-child text-[4.4vh] leading-[1.4]"
        >
          {frame.lines.map((line, index) =>
            line ? (
              <p
                key={index}
                ref={index === frame.current ? heard : undefined}
                className={index === frame.current ? 'font-bold' : 'text-bark-900'}
                style={index === frame.current ? { color: frame.colour } : undefined}
              >
                {line}
              </p>
            ) : (
              <div key={index} className="h-[0.6em]" />
            ),
          )}
        </div>
      </div>
    </div>
  );
}
