'use client';

import { useEffect, useState } from 'react';
import { resumeTv, stopTv, useTvStatus } from '../../lib/tv-link';
import { TvIcon } from '../icons';
import { TvScanner } from './tv-scanner';

/** Watch on TV (At home): scan the TV's code; once connected, the same button stops showing on the TV. */
export function TvButton() {
  const status = useTvStatus();
  const [scanning, setScanning] = useState(false);

  useEffect(() => resumeTv(), []);

  const connected = status !== 'none';
  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (!connected) setScanning(true);
          else if (window.confirm('Stop showing on the TV?\nDừng chiếu lên TV?')) void stopTv();
        }}
        aria-label={connected ? 'On the TV: stop showing · Dừng chiếu' : 'Watch on TV · Xem trên TV'}
        title={connected ? 'Stop showing on the TV' : 'Watch on TV'}
        className={`relative grid size-11 place-items-center rounded-full ${connected ? 'bg-leaf-600 text-white' : 'bg-cream-200 text-bark-900 hover:bg-cream-100'}`}
      >
        <TvIcon className="size-6" />
        {status === 'offline' || status === 'connecting' ? (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-sun-400 ring-2 ring-cream-50"
          />
        ) : null}
      </button>
      {scanning ? <TvScanner onClose={() => setScanning(false)} onPaired={() => setScanning(false)} /> : null}
    </>
  );
}
