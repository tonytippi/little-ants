import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { andika } from '@little-ants/ui/lib/font-andika';
import { baloo } from '@little-ants/ui/lib/font-baloo';
import { poppins } from '@little-ants/ui/lib/font-poppins';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: { default: 'Little Ants Listening', template: '%s · Little Ants Listening' },
  description: 'Listening Time: the songs, stories and rhymes of Little Ants English, a few minutes a day.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/favicon.png', apple: '/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'Little Ants Student', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#4f7f32',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${poppins.variable} ${andika.variable} ${baloo.variable}`}>
      <body className="min-h-dvh text-[15px] leading-normal antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
