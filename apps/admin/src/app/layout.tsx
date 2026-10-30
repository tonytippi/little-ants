import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { andika } from '@little-ants/ui/lib/font-andika';
import { nunito } from '@little-ants/ui/lib/font-nunito';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: { default: 'Little Ants Admin', template: '%s · Little Ants Admin' },
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'Little Ants Admin', statusBarStyle: 'default' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${nunito.variable} ${andika.variable}`}>
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
