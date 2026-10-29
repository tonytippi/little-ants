'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@little-ants/ui/button';
import { startCasting, stopCasting, type CastState } from '../../lib/cast';
import { links } from '../../lib/links';

interface Props {
  cast: CastState;
  /** The second window (laptop + HDMI) is open and showing the lesson. */
  windowConnected: boolean;
  windowOpen: boolean;
  onOpenWindow: () => void;
}

const castHint: Record<CastState['status'], string> = {
  unavailable: 'Needs Google Chrome',
  'no-devices': 'No TV found on this Wi-Fi',
  ready: 'Pick a TV on this Wi-Fi',
  connecting: 'Connecting…',
  connected: '',
};

/** "Show on TV": cast to a Chromecast / Android TV, or open a second window for a TV plugged into the laptop. */
export function TvMenu({ cast, windowConnected, windowOpen, onOpenWindow }: Props) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function close(event: PointerEvent): void {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  const casting = cast.status === 'connected';
  const label = casting
    ? `On TV: ${cast.device ?? 'TV'}`
    : cast.status === 'connecting'
      ? 'Connecting…'
      : windowOpen
        ? windowConnected
          ? 'TV on'
          : 'TV window…'
        : 'Show on TV';
  const canCast = cast.status === 'ready' || cast.status === 'connecting';

  return (
    <div ref={box} className="relative">
      <Button
        size="md"
        variant={casting || windowOpen ? 'primary' : 'secondary'}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="max-w-56"
      >
        <span className="truncate">{label}</span>
      </Button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-2 flex w-72 flex-col gap-1 rounded-2xl bg-white p-2 shadow-xl ring-1 ring-cream-200"
        >
          {casting ? (
            <MenuItem
              title="Stop showing on TV"
              hint={cast.device ?? undefined}
              onClick={() => {
                stopCasting();
                setOpen(false);
              }}
            />
          ) : (
            <MenuItem
              title="Chromecast / Android TV"
              hint={castHint[cast.status]}
              disabled={!canCast}
              onClick={() => {
                setOpen(false);
                // The teacher may close Chrome's device picker: nothing to do then.
                startCasting().catch(() => undefined);
              }}
            />
          )}
          <MenuItem
            title="Second window"
            hint="For a TV plugged into this laptop"
            onClick={() => {
              setOpen(false);
              onOpenWindow();
            }}
          />
          <Link
            href={links.tvHelp()}
            target="_blank"
            role="menuitem"
            className="rounded-xl px-3 py-2 text-sm font-semibold text-leaf-700 hover:bg-cream-100"
          >
            How to show lessons on a TV
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({
  title,
  hint,
  disabled = false,
  onClick,
}: {
  title: string;
  hint?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className="flex flex-col items-start rounded-xl px-3 py-2 text-left hover:bg-cream-100 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
    >
      <span className="font-bold text-bark-900">{title}</span>
      {hint ? <span className="text-xs text-bark-500">{hint}</span> : null}
    </button>
  );
}
