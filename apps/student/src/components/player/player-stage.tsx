'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReleaseMedia } from '@little-ants/shared';
import type { Slide } from '../../lib/player-plan';

/** The picture of the moment, faded into the page; a big letter or word on top for sounds and word cards. */
export function PlayerStage({ slide, colour, cover }: { slide: Slide; colour: string; cover: boolean }) {
  return (
    <div className="fade-soft relative grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-[36px] bg-white md:max-h-[calc(100dvh-16rem)]">
      {slide.picture ? <StageImage key={slide.picture.url} picture={slide.picture} cover={cover} /> : null}
      {slide.big && !slide.picture ? (
        <span
          className="font-display text-[clamp(80px,14vw,170px)] leading-none font-extrabold"
          style={{ color: colour }}
          aria-hidden
        >
          {slide.big}
        </span>
      ) : null}
    </div>
  );
}

function StageImage({ picture, cover }: { picture: ReleaseMedia; cover: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    // Plain <img>: media comes from the offline cache / media domain, not the Next image optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={picture.url}
      alt=""
      draggable={false}
      onError={() => setFailed(true)}
      className={`absolute inset-0 size-full ${cover ? 'object-cover' : 'object-contain'}`}
    />
  );
}

/** The words of the moment: lyrics with the line being heard highlighted, a page's text, or a big word. */
export function PlayerText({ slide, colour, large }: { slide: Slide; colour: string; large: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const heardLine = useRef<HTMLParagraphElement>(null);
  const { current, lines } = slide;
  // Keep the line being heard in view in long lyrics (scrolls the lyrics box only, never the page).
  useEffect(() => {
    const container = box.current;
    const line = heardLine.current;
    if (container && line) container.scrollTop = Math.max(0, line.offsetTop - container.clientHeight / 3);
  }, [current, lines]);

  return (
    <div className="flex flex-col gap-1">
      {slide.big ? (
        <div className="flex flex-wrap items-baseline gap-3">
          <span
            className={`leading-none ${slide.small ? 'font-display text-[clamp(64px,10vw,140px)] font-extrabold' : 'font-child text-[clamp(44px,7vw,96px)] font-bold'}`}
            style={{ color: colour }}
          >
            {slide.big}
          </span>
          {slide.small ? <span className="font-child text-2xl text-bark-500">{slide.small}</span> : null}
        </div>
      ) : null}
      <div
        ref={box}
        className={`relative max-h-[42vh] overflow-auto md:max-h-[max(5.5rem,calc(100dvh-35rem))] pr-1.5 font-child leading-[1.45] ${large ? 'text-[clamp(22px,2.6vw,40px)]' : 'text-[clamp(19px,2.3vw,25px)]'}`}
      >
        {slide.lines.map((line, index) =>
          line ? (
            <p
              key={index}
              ref={index === slide.current ? heardLine : undefined}
              className={index === slide.current ? 'font-bold' : ''}
              style={index === slide.current ? { color: colour } : undefined}
            >
              {line}
            </p>
          ) : (
            <div key={index} className="h-[0.6em]" />
          ),
        )}
      </div>
    </div>
  );
}
