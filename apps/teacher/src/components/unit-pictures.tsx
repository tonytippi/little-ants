'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReleaseMedia, UnitReleasePayload } from '@little-ants/shared';

interface Shown {
  image: ReleaseMedia;
  label: string;
}

/**
 * The unit cover and the places the unit happens in (garden, market…). Tapping a picture shows it full screen,
 * e.g. on the classroom TV. Releases published before unit pictures existed have none, and this renders nothing.
 */
export function UnitPictures({ unit }: { unit: UnitReleasePayload['unit'] }) {
  const [shown, setShown] = useState<Shown | null>(null);
  const places = unit.places ?? [];
  if (!unit.cover && places.length === 0) return null;

  return (
    <section aria-label="Unit pictures" className="mb-6 flex flex-wrap items-end gap-4">
      {unit.cover ? (
        <Thumb
          image={unit.cover}
          label={`${unit.title} cover`}
          large
          onOpen={() => setShown({ image: unit.cover!, label: unit.title })}
        />
      ) : null}
      {places.length ? (
        <div>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-bark-500">Places</h2>
          <ul className="flex flex-wrap gap-3">
            {places.map((place) => (
              <li key={place.image.id}>
                <Thumb
                  image={place.image}
                  label={place.label}
                  onOpen={() => setShown({ image: place.image, label: place.label })}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <FullScreen shown={shown} onClose={() => setShown(null)} />
    </section>
  );
}

function Thumb({
  image,
  label,
  large = false,
  onOpen,
}: {
  image: ReleaseMedia;
  label: string;
  large?: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col items-center gap-1 rounded-2xl text-sm font-semibold text-bark-700 focus-visible:outline-3 focus-visible:outline-leaf-600"
      aria-label={`Show ${label} full screen`}
    >
      {/* Plain <img>: media comes from the offline cache / media domain, not the Next image optimizer. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.url}
        alt=""
        className={`${large ? 'h-40 w-64' : 'h-24 w-36'} rounded-2xl object-cover shadow-sm ring-1 ring-cream-200 transition group-hover:shadow-md`}
        draggable={false}
      />
      {large ? null : <span className="capitalize">{label}</span>}
    </button>
  );
}

function FullScreen({ shown, onClose }: { shown: Shown | null; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (shown && !element.open) element.showModal();
    if (!shown && element.open) element.close();
  }, [shown]);

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={onClose}
      aria-label={shown?.label ?? 'Picture'}
      className="m-0 h-full max-h-none w-full max-w-none bg-bark-900 p-0 backdrop:bg-bark-900"
    >
      {shown ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={shown.image.url}
            alt={shown.label}
            className="max-h-[90%] max-w-full rounded-2xl object-contain"
            draggable={false}
          />
          <p className="font-child text-2xl capitalize text-white">{shown.label}</p>
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full bg-white/90 px-4 py-2 font-bold text-bark-900"
          >
            Close
          </button>
        </div>
      ) : null}
    </dialog>
  );
}
