'use client';

import { useState } from 'react';
import type { ReleaseMedia } from '@little-ants/shared';

/**
 * The storybook look from Brand Guidelines v2.1 and the Listening App design: crayon pictures that fade into the
 * page (no frames), Baloo 2 titles in Ant Red, and one big red button per screen.
 */

/** Fades a picture into the page at its edges, like the crayon illustrations on paper. */
export const fadeClass = '[mask-image:radial-gradient(ellipse_at_center,#000_58%,transparent_76%)]';

/** The one main action on a screen: a round Ant Red button that presses down. */
export const ctaClass =
  'inline-flex items-center justify-center gap-2.5 rounded-full bg-ant-500 px-6 py-3.5 font-display text-xl font-bold leading-none text-white shadow-[0_6px_0_var(--color-ant-600)] transition-transform hover:bg-ant-600 active:translate-y-[3px] active:shadow-[0_3px_0_var(--color-ant-600)]';

/**
 * A unit picture faded at the edges. Tall pictures (character art) are shown whole, wide ones (covers) fill the box.
 * Renders nothing without a picture or when the file cannot load, e.g. offline before the unit is downloaded.
 */
export function UnitArt({
  picture,
  alt = '',
  className = '',
}: {
  picture: ReleaseMedia | null | undefined;
  alt?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const [tall, setTall] = useState(false);
  if (!picture || failed) return null;
  return (
    // Plain <img>: media comes from the offline cache / media domain, not the Next image optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={picture.url}
      alt={alt}
      draggable={false}
      onError={() => setFailed(true)}
      onLoad={(event) => setTall(event.currentTarget.naturalHeight > event.currentTarget.naturalWidth)}
      className={`${tall ? 'object-contain' : 'object-cover'} ${fadeClass} ${className}`}
    />
  );
}
