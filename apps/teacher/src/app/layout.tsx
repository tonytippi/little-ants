import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { andika } from '@little-ants/ui/lib/font-andika';
import { baloo } from '@little-ants/ui/lib/font-baloo';
import { nunito } from '@little-ants/ui/lib/font-nunito';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: { default: 'Little Ants Teacher', template: '%s · Little Ants Teacher' },
  description: 'Prepare and teach Little Ants English lessons, online or offline.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'Little Ants Teacher', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#4f7f32',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${nunito.variable} ${andika.variable} ${baloo.variable}`}>
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
