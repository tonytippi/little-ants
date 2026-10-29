'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
// Loaded first so the browser's install prompt is caught even before a screen with the Install button mounts.
import '@little-ants/ui/lib/install';
import { startOutbox } from '../lib/outbox';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false, networkMode: 'always' },
        },
      }),
  );
  useEffect(() => {
    // TV screens (Cast receiver, laptop screen) have no teacher session to sync and no offline use.
    const path = window.location.pathname;
    if (path.startsWith('/cast-receiver') || path === '/screen' || path === '/screen/') return;
    startOutbox();
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker
        .register(`/sw.js?v=${process.env.NEXT_PUBLIC_BUILD_ID ?? 'dev'}`)
        .catch(() => undefined);
    }
  }, []);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
