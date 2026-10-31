import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TvPairScreen } from '../../../../components/tv/tv-pair-screen';

export const metadata: Metadata = { title: 'Watch on TV' };

export default function TvPairPage() {
  // The code comes in the query string from the TV's QR code; it is read on the device.
  return (
    <Suspense>
      <TvPairScreen />
    </Suspense>
  );
}
